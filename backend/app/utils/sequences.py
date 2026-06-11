"""
Sequence counter utility — generates human-readable codes.

All counters are stored in the `sequence_counters` table.
Callers must hold a DB transaction; next_value() does NOT commit.

Examples
--------
Notebook  : OQ-R1-S1-NB001   scope_key="NB:OQ-R1-S1"
Experiment: OQ/R1/S1/E03166  scope_key="EXP:OQ-R1-S1"
ATR       : ATR00066041       scope_key="ATR"
"""
from typing import Optional

from sqlalchemy.orm import Session
from sqlalchemy import select

from app.models.sequence import SequenceCounter
from app.models.base import new_uuid


def next_value(db: Session, scope_key: str) -> int:
    """
    Atomically increment and return the next counter value for scope_key.

    Uses SELECT … FOR UPDATE to prevent race conditions under concurrent requests.
    """
    counter = (
        db.execute(
            select(SequenceCounter)
            .where(SequenceCounter.scope_key == scope_key)
            .with_for_update()
        )
        .scalar_one_or_none()
    )

    if counter is None:
        counter = SequenceCounter(
            id        = new_uuid(),
            scope_key = scope_key,
            prefix    = scope_key.split(":")[0],
            last_value= 0,
        )
        db.add(counter)

    counter.last_value += 1
    db.flush()
    return counter.last_value


def next_notebook_code(
    db:           Session,
    project_code: str,
    route_code:   Optional[str] = None,
    stage_code:   Optional[str] = None,
) -> str:
    """
    Generate the next notebook code.
    Format: {project}-{route}-{stage}-NB{seq:03d}
    e.g.    OQ-R1-S1-NB001

    If no route/stage:  OQ-NB001
    """
    parts = [project_code]
    if route_code:
        parts.append(route_code)
    if stage_code:
        parts.append(stage_code)

    scope_key = "NB:" + "-".join(parts)
    seq = next_value(db, scope_key)
    return "-".join(parts) + f"-NB{seq:03d}"


