# Backward-compatibility shim — canonical source moved to app.modules.auth.dependencies
from app.modules.auth.dependencies import bearer, get_current_user, require_roles  # noqa: F401
