#!/usr/bin/env bash
#
# Publishes the VeloPulse demo site on the institor cluster.
#
# What the site serves:
#   /         the demo app, as before;
#   /app/     the same demo app, the address the landing page links to;
#   /landing/ the product landing page of docs/.
#
# What the script does, in order:
#   1. builds the app with `npm run build`, with VITE_DEMO_ONLY=1 so the
#      demo opens straight into the demo account: no login screen, no API
#      key field, no logout button (RF-013). Every other build (Android,
#      desktop, a site built from the plain source) leaves the variable
#      unset and keeps the normal login and logout;
#   2. puts index.html and the legal pages in the ConfigMap `web-root`;
#   3. splits the files of `dist/assets` over several ConfigMaps;
#   4. puts the files of `docs/` in the ConfigMaps `web-landing-*`;
#   5. applies web.yaml (nginx config, Deployment, Service);
#   6. restarts the Deployment and waits for the new pods.
#
# Why several ConfigMaps for the assets and for the screenshots: a ConfigMap
# cannot be larger than 1 MiB in total, all keys included, because etcd
# refuses larger objects, and a binary file counts as its base64 form, a third
# larger than the file. Both sets are bigger than that, so the files are
# spread over several ConfigMaps and a `projected` volume joins them back into
# a single directory. The Vite config splits the bundle in chunks so that no
# single file gets close to the limit.
#
# Screenshots of docs/: the eight files are 1,879 kB of base64 altogether, so
# they need three ConfigMaps to stay under the budget of MAX_CONFIGMAP_BYTES
# each. No single screenshot may be larger than about 780 kB on disk, or its
# base64 form alone fills a whole ConfigMap. A screenshot over that size has
# to be saved as JPEG first (max width 1600 px, quality 82, under 250 kB),
# with the `src`, `width` and `height` of docs/index.html updated to the new
# file.
#
# The script is idempotent: every ConfigMap is rendered from scratch and
# applied, so a second run replaces the keys instead of adding to them. This
# matters because the file names of the build carry a content hash: after a
# new build the old names disappear, and an `apply` of the whole object drops
# them.
#
# Moving the landing page to the root: the root of the site still serves the
# demo app, because that is what requirement RF-013 says. When the owner
# agrees to the change, only web.yaml changes:
#   - the volume `landing-root` moves from /usr/share/nginx/html/landing to
#     /usr/share/nginx/html, and `landing-css`, `landing-js` and
#     `landing-screenshots` follow it to /css, /js and /screenshots;
#   - the volumes `site-root` and `site-assets` go away: the app stays only
#     under /app/, which already has its own mounts;
#   - in the nginx config the `location /landing/` block and the regular
#     expression block of its files go away, the `location /` block gets the
#     `try_files $uri $uri/index.html =404;` of the landing page, and the
#     files of the landing page get their own locations at the root.
# The ConfigMaps do not change, and neither does this script.
#
# Usage: deploy/institor-demo/publish.sh
#
set -euo pipefail

KUBE_CONTEXT="${KUBE_CONTEXT:-velopulse}"

# Number of ConfigMaps for the build output. They are always all created, even
# when empty, because web.yaml lists them in the projected volume and a missing
# ConfigMap keeps the pod from starting. web.yaml and this value must agree.
ASSET_CONFIGMAPS=4

# Number of ConfigMaps for the screenshots of the landing page. Same rule:
# web.yaml lists them all.
LANDING_SHOT_CONFIGMAPS=3

# Highest size accepted for a single rendered ConfigMap. The hard limit is
# 1 MiB (1048576 bytes); this leaves room for keys, labels and metadata.
MAX_CONFIGMAP_BYTES=900000

# Labels written on the ConfigMaps created below. The ConfigMaps of the build
# carry none, as they always have; the ones of the landing page carry
# app=web, like web-nginx.
CONFIGMAP_LABELS=""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
DIST_DIR="${PROJECT_DIR}/dist"
DOCS_DIR="${PROJECT_DIR}/docs"
WORK_DIR="$(mktemp -d)"
trap 'rm -rf "${WORK_DIR}"' EXIT

kube() {
  kubectl --context "${KUBE_CONTEXT}" "$@"
}

# Renders a ConfigMap from a list of files and applies it. Fails if the
# rendered object is too large for etcd.
#   apply_configmap <name> [file ...]
apply_configmap() {
  local name="$1"
  shift

  local args=()
  local file
  for file in "$@"; do
    args+=("--from-file=$(basename "${file}")=${file}")
  done

  # A bucket can be empty: the ConfigMap is created anyway, because web.yaml
  # lists it in the projected volume.
  local rendered="${WORK_DIR}/${name}.yaml"
  if [ -n "${CONFIGMAP_LABELS}" ]; then
    kubectl create configmap "${name}" ${args[@]+"${args[@]}"} \
      --dry-run=client -o yaml |
      kubectl label --local -f - -o yaml "${CONFIGMAP_LABELS}" >"${rendered}"
  else
    kubectl create configmap "${name}" ${args[@]+"${args[@]}"} \
      --dry-run=client -o yaml >"${rendered}"
  fi

  local size
  size="$(wc -c <"${rendered}")"
  if [ "${size}" -gt "${MAX_CONFIGMAP_BYTES}" ]; then
    echo "ERROR: ConfigMap ${name} is ${size} bytes, over the ${MAX_CONFIGMAP_BYTES} byte budget." >&2
    echo "       Split the files further: raise the number of ConfigMaps and list the" >&2
    echo "       new one in web.yaml, or make the largest file smaller." >&2
    exit 1
  fi

  # Server-side apply, not the plain one: a plain `kubectl apply` keeps a copy
  # of the whole object in the annotation
  # kubectl.kubernetes.io/last-applied-configuration, and that annotation may
  # not be larger than 256 KiB. The asset ConfigMaps are larger than that, so
  # a plain apply fails with "metadata.annotations: Too long". Server-side
  # apply writes no annotation and still drops the keys that disappeared from
  # the build, which is what keeps a second run from piling up old files.
  kube apply --server-side --force-conflicts -f "${rendered}" >/dev/null
  printf '  %-22s %7d bytes  %d file(s)\n' "${name}" "${size}" "$#"
}

# Spreads a list of files over numbered ConfigMaps and applies them all.
# Greedy bin packing from the largest file: each file goes to the bucket that
# holds the least so far, so the buckets end up roughly the same size.
#   apply_bucketed_configmaps <name prefix> <bucket count> <file ...>
apply_bucketed_configmaps() {
  local prefix="$1"
  local buckets="$2"
  shift 2

  local -a sorted
  mapfile -t sorted < <(stat --format '%s %n' -- "$@" | sort -rn | cut -d' ' -f2-)

  local -a bucket_bytes bucket_files
  local i
  for ((i = 0; i < buckets; i++)); do
    bucket_bytes[i]=0
    bucket_files[i]=""
  done

  local file size smallest
  for file in ${sorted[@]+"${sorted[@]}"}; do
    size="$(wc -c <"${file}")"
    smallest=0
    for ((i = 1; i < buckets; i++)); do
      if [ "${bucket_bytes[i]}" -lt "${bucket_bytes[smallest]}" ]; then
        smallest="${i}"
      fi
    done
    bucket_bytes[smallest]=$((bucket_bytes[smallest] + size))
    bucket_files[smallest]="${bucket_files[smallest]}${file}"$'\n'
  done

  local -a files
  for ((i = 0; i < buckets; i++)); do
    mapfile -t files < <(printf '%s' "${bucket_files[i]}")
    apply_configmap "${prefix}-$((i + 1))" ${files[@]+"${files[@]}"}
  done
}

echo "1. Build"
VITE_DEMO_ONLY=1 npm --prefix "${PROJECT_DIR}" run build

if [ ! -f "${DIST_DIR}/index.html" ]; then
  echo "ERROR: ${DIST_DIR}/index.html is missing: the build produced nothing." >&2
  exit 1
fi

echo "2. ConfigMap of the root pages"
root_files=("${DIST_DIR}/index.html")
for page in privacy.html termini.html; do
  if [ -f "${DIST_DIR}/${page}" ]; then
    root_files+=("${DIST_DIR}/${page}")
  else
    echo "ERROR: ${DIST_DIR}/${page} is missing. Privacy and terms are required." >&2
    exit 1
  fi
done
apply_configmap web-root "${root_files[@]}"

echo "3. ConfigMaps of the build output"
mapfile -t asset_files < <(find "${DIST_DIR}/assets" -maxdepth 1 -type f)

if [ "${#asset_files[@]}" -eq 0 ]; then
  echo "ERROR: ${DIST_DIR}/assets is empty." >&2
  exit 1
fi

apply_bucketed_configmaps web-assets "${ASSET_CONFIGMAPS}" "${asset_files[@]}"

echo "4. ConfigMaps of the landing page"
# These carry the label of the site, like web-nginx.
CONFIGMAP_LABELS="app=web"

landing_pages=()
for page in index.html privacy.html termini.html; do
  if [ -f "${DOCS_DIR}/${page}" ]; then
    landing_pages+=("${DOCS_DIR}/${page}")
  else
    echo "ERROR: ${DOCS_DIR}/${page} is missing. Privacy and terms are required." >&2
    exit 1
  fi
done
apply_configmap web-landing-root "${landing_pages[@]}"
apply_configmap web-landing-css "${DOCS_DIR}/css/style.css"
apply_configmap web-landing-js "${DOCS_DIR}/js/main.js"

# Only the screenshots the page really uses, so an old file left in the
# directory does not fill a ConfigMap. The large PNG of the activity map
# stays in the repository for the README and is not published: index.html
# uses the JPEG.
mapfile -t shot_files < <(
  grep -o 'screenshots/[A-Za-z0-9_.-]*' "${DOCS_DIR}/index.html" |
    sort -u | sed "s|^|${DOCS_DIR}/|"
)

if [ "${#shot_files[@]}" -eq 0 ]; then
  echo "ERROR: ${DOCS_DIR}/index.html uses no screenshot: check the page." >&2
  exit 1
fi

for file in "${shot_files[@]}"; do
  if [ ! -f "${file}" ]; then
    echo "ERROR: ${file} is used by docs/index.html but does not exist." >&2
    exit 1
  fi
done

apply_bucketed_configmaps web-landing-shots "${LANDING_SHOT_CONFIGMAPS}" "${shot_files[@]}"
CONFIGMAP_LABELS=""

echo "5. Apply web.yaml"
kube apply -f "${SCRIPT_DIR}/web.yaml"

echo "6. Restart and wait"
# The pod reads the files from the ConfigMaps at start-up, so a restart is what
# makes the new build visible. A selector, not --all: the namespace also holds
# objects of the platform that may not be touched.
kube rollout restart deployment/web
kube rollout status deployment/web --timeout=180s

echo
kube get deploy,svc,pods -l app=web
