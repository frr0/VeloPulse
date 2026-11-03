// Whether this build is the publicly reachable demo site. Set only by the
// demo publish script (deploy/institor-demo/publish.sh), which builds with
// VITE_DEMO_ONLY=1. Every other build (Android, desktop, a site built from
// the plain source) leaves the variable unset, so the app behaves exactly as
// before: login screen, API key field and logout button all present.
export const DEMO_ONLY = import.meta.env.VITE_DEMO_ONLY === '1';
