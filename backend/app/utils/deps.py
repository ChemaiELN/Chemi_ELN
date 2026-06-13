# Backward-compatibility shim — canonical source moved to app.modules.auth.dependencies
from app.modules.auth.dependencies import bearer, get_current_user, require_roles  # noqa: F401
from app.utils.privileges import require_privilege  # noqa: F401
