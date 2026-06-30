"""Inventory audit trail writer."""
import datetime
from sqlalchemy.orm import Session


def write_inv_audit(
    db: Session,
    *,
    event_type: str,
    entity_type: str,
    entity_id: str | int | None = None,
    entity_ref: str | None = None,
    performed_by: str,
    old_value: str | None = None,
    new_value: str | None = None,
    details: str | None = None,
) -> None:
    from app.models.inventory import InvAuditTrail

    db.add(InvAuditTrail(
        event_type=event_type,
        entity_type=entity_type,
        entity_id=str(entity_id) if entity_id is not None else None,
        entity_ref=entity_ref,
        performed_by=performed_by,
        performed_at=datetime.datetime.utcnow(),
        old_value=old_value,
        new_value=new_value,
        details=details,
    ))
