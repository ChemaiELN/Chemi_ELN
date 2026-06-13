# Backward-compatibility shim — canonical source moved to app.modules.auth.esignature
from app.modules.auth.esignature import (  # noqa: F401
    ESignatureRequired,
    verify_esignature,
    get_crd_settings,
)
