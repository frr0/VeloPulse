#!/usr/bin/env bash
#
# Publishes the VeloPulse demo site on the institor cluster.
#
# What it does, in order:
#   1. builds the app with `npm run build`;
#   2. puts index.html and the legal pages in the ConfigMap `web-root`;
#   3. splits the files of `dist/assets` over several ConfigMaps;
#   4. applies web.yaml (nginx config, Deployment, Service);
#   5. restarts the Deployment and waits for the new pods.
#
# Why several ConfigMaps for the assets: a ConfigMap cannot be larger than
# 1 MiB in total, all keys included, because etcd refuses larger objects. The
# whole build is bigger than that, so the files are spread over
# ASSET_CONFIGMAPS ConfigMaps and a `projected` volume joins them back into a
# single directory, /usr/share/nginx/html/assets. The Vite config splits the
# bundle in chunks so that no single file gets close to the limit.
#
# The script is idempotent: every ConfigMap is rendered from scratch and
# applied, so a second run replaces the keys instead of adding to them. This
# matters because the file names carry a content hash: after a new build the
# old names disappear, and an `apply` of the whole object drops them.
#
# Usage: deploy/institor-demo/publish.sh
#
set -euo pipefail

KUBE_CONTEXT="${KUBE_CONTEXT:-velopulse}"

# Number of ConfigMaps for the build output. They are always all created, even
# when empty, because web.yaml lists them in the projected volume and a missing
# ConfigMap keeps the pod from starting. web.yaml and this value must agree.
ASSET_CONFIGMAPS=4

# Highest size accepted for a single rendered ConfigMap. The hard limit is
# 1 MiB (1048576 bytes); this leaves room for keys, labels and metadata.
MAX_CONFIGMAP_BYTES=900000

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
DIST_DIR="${PROJECT_DIR}/dist"
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
  kubectl create configmap "${name}" ${args[@]+"${args[@]}"} \
    --dry-run=client -o yaml >"${rendered}"

  local size
  size="$(wc -c <"${rendered}")"
  if [ "${size}" -gt "${MAX_CONFIGMAP_BYTES}" ]; then
    echo "ERROR: ConfigMap ${name} is ${size} bytes, over the ${MAX_CONFIGMAP_BYTES} byte budget." >&2
    echo "       Split the bundle further in vite.config.ts, or raise ASSET_CONFIGMAPS." >&2
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
  printf '  %-16s %7d bytes  %d file(s)\n' "${name}" "${size}" "$#"
}

echo "1. Build"
npm --prefix "${PROJECT_DIR}" run build

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
# Files sorted from the largest, so the next step fills the emptiest bucket
# first and the buckets end up roughly the same size.
mapfile -t asset_files < <(find "${DIST_DIR}/assets" -maxdepth 1 -type f -printf '%s\t%p\n' |
  sort -rn | cut -f2)

if [ "${#asset_files[@]}" -eq 0 ]; then
  echo "ERROR: ${DIST_DIR}/assets is empty." >&2
  exit 1
fi

# Greedy bin packing: each file goes to the bucket that holds the least so far.
declare -a bucket_bytes bucket_files
for ((i = 0; i < ASSET_CONFIGMAPS; i++)); do
  bucket_bytes[i]=0
  bucket_files[i]=""
done

for file in "${asset_files[@]}"; do
  size="$(wc -c <"${file}")"
  smallest=0
  for ((i = 1; i < ASSET_CONFIGMAPS; i++)); do
    if [ "${bucket_bytes[i]}" -lt "${bucket_bytes[smallest]}" ]; then
      smallest="${i}"
    fi
  done
  bucket_bytes[smallest]=$((bucket_bytes[smallest] + size))
  bucket_files[smallest]="${bucket_files[smallest]}${file}"$'\n'
done

for ((i = 0; i < ASSET_CONFIGMAPS; i++)); do
  mapfile -t files < <(printf '%s' "${bucket_files[i]}")
  apply_configmap "web-assets-$((i + 1))" ${files[@]+"${files[@]}"}
done

echo "4. Apply web.yaml"
kube apply -f "${SCRIPT_DIR}/web.yaml"

echo "5. Restart and wait"
# The pod reads the files from the ConfigMaps at start-up, so a restart is what
# makes the new build visible.
kube rollout restart deployment/web
kube rollout status deployment/web --timeout=180s

echo
kube get deploy,svc,pods -l app=web
