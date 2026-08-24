// ============================================================
//  Laurus ELN — Runtime Configuration
// ------------------------------------------------------------
//  EDIT THIS FILE ON THE SERVER AFTER DEPLOYING.
//  Set API_URL to the backend server's intranet address.
//  Example:  http://192.168.1.50:8000
//  (Use the server's real IP/hostname and the backend port.)
//  No rebuild is needed — just edit and refresh the browser.
// ============================================================
window.__APP_CONFIG__ = {
  API_URL: typeof window !== "undefined" && window.location.hostname ? (window.location.protocol + "//" + window.location.hostname + ":8000") : "http://localhost:8000"
};

