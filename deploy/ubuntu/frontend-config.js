// ============================================================
//  Laurus ELN — Runtime Configuration  (production / nginx)
// ------------------------------------------------------------
//  Deployed to /var/www/laurus-eln/config.js
//
//  The frontend and API share one origin: nginx serves this app
//  on port 80 and reverse-proxies /api to the backend on
//  127.0.0.1:8000. So API_URL is simply this page's own origin —
//  no port, no CORS, and it keeps working if the server's IP or
//  hostname changes, or if you put TLS in front of it later.
//
//  Editable on the server without rebuilding — nginx serves this
//  file with no-store, so a browser refresh picks up changes.
//
//  Only hardcode an absolute URL here if you deliberately run the
//  API on a different host, e.g.:
//      API_URL: "http://192.168.205.247:8000"
//  (that variant requires CORS_ORIGINS in the backend .env to
//   list this frontend's origin)
// ============================================================
window.__APP_CONFIG__ = {
  API_URL: window.location.origin
};
