"""
Security headers middleware.

Adds standard hardening headers to every HTTP response:
  - X-Content-Type-Options: nosniff       — prevent MIME-type sniffing
  - X-Frame-Options: DENY                 — block clickjacking via iframes
  - X-XSS-Protection: 0                  — disable legacy XSS filter (CSP is the modern replacement)
  - Content-Security-Policy              — restrict resource origins
  - Strict-Transport-Security            — force HTTPS (ignored over plain HTTP)
  - Referrer-Policy                      — limit referrer leakage
  - Permissions-Policy                   — disable unused browser APIs
"""
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "0"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data:; "
            "font-src 'self'; "
            "connect-src 'self'; "
            "frame-ancestors 'none';"
        )
        return response
