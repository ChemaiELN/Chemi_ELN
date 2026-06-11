"""
Structured request/response logging middleware + body size guard.

Emits one JSON log line per request containing:
  request_id   — UUID injected into X-Request-ID response header
  method       — HTTP method
  path         — URL path (query string excluded)
  status_code  — HTTP response status
  latency_ms   — wall-clock time for the full request/response cycle
  user_id      — extracted from the Bearer JWT (best-effort, None if absent/invalid)
  ip           — client IP

For regulatory readiness (21 CFR Part 11 / EU Annex 11) every request is
traceable to a user, timestamp, and outcome. These logs complement the
append-only AuditLog table which captures semantic workflow events.
"""
import json
import logging
import time
import uuid
from typing import Callable

from jose import JWTError, jwt
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.types import ASGIApp

logger = logging.getLogger("chemia.access")


def _extract_user_id(request: Request, secret: str, algorithm: str) -> str | None:
    """Best-effort JWT decode — never raises."""
    try:
        auth = request.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            return None
        token = auth.split(" ", 1)[1]
        payload = jwt.decode(token, secret, algorithms=[algorithm])
        return payload.get("sub")
    except (JWTError, Exception):
        return None


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Injects X-Request-ID and emits a structured access log for every request."""

    def __init__(self, app: ASGIApp, *, secret_key: str, algorithm: str = "HS256") -> None:
        super().__init__(app)
        self._secret = secret_key
        self._algorithm = algorithm

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        request_id = str(uuid.uuid4())
        start = time.monotonic()

        # Make the request_id available to downstream handlers if needed
        request.state.request_id = request_id

        response: Response = await call_next(request)

        latency_ms = round((time.monotonic() - start) * 1000, 1)
        user_id = _extract_user_id(request, self._secret, self._algorithm)

        log_record = {
            "request_id": request_id,
            "method":     request.method,
            "path":       request.url.path,
            "status":     response.status_code,
            "latency_ms": latency_ms,
            "user_id":    user_id,
            "ip":         request.client.host if request.client else None,
        }

        level = logging.WARNING if response.status_code >= 500 else logging.INFO
        logger.log(level, json.dumps(log_record))

        response.headers["X-Request-ID"] = request_id
        return response


class BodySizeLimitMiddleware(BaseHTTPMiddleware):
    """
    Reject requests whose Content-Length exceeds max_bytes before the body is read.

    File upload endpoints are excluded because their bodies are handled by
    save_upload() which already enforces MAX_UPLOAD_BYTES via streaming.
    This middleware guards JSON endpoints from oversized payloads that could
    cause memory pressure or slow queries.
    """

    UPLOAD_PATH_FRAGMENTS = ("/attachments", "/final-reports", "/scheme-image")

    def __init__(self, app: ASGIApp, *, max_bytes: int) -> None:
        super().__init__(app)
        self._max_bytes = max_bytes

    def _is_upload(self, path: str) -> bool:
        return any(frag in path for frag in self.UPLOAD_PATH_FRAGMENTS)

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if not self._is_upload(request.url.path):
            content_length = request.headers.get("content-length")
            if content_length and int(content_length) > self._max_bytes:
                mb = self._max_bytes // (1024 * 1024)
                return JSONResponse(
                    status_code=413,
                    content={"detail": f"Request body exceeds the {mb} MB limit"},
                )
        return await call_next(request)


def configure_logging(log_level: str = "INFO") -> None:
    """
    Configure the root logger to emit JSON-structured lines.

    Call once at application startup before the app starts handling requests.
    In production, pipe stdout to a log aggregator (ELK, CloudWatch, Datadog).
    """
    numeric_level = getattr(logging, log_level.upper(), logging.INFO)
    logging.basicConfig(
        level=numeric_level,
        format='{"time":"%(asctime)s","level":"%(levelname)s","logger":"%(name)s","msg":%(message)s}',
        datefmt="%Y-%m-%dT%H:%M:%S",
    )
    # Silence noisy third-party loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
