"""
Routes & Stages router.

Endpoints:
    POST   /api/routes/{project_id}/routes              Create route (+ optional stages inline)
    GET    /api/routes/{project_id}/routes              List routes for a project
    GET    /api/routes/{project_id}/routes/{route_id}   Get route with stages
    PATCH  /api/routes/{project_id}/routes/{route_id}   Update route

    POST   /api/routes/{project_id}/routes/{route_id}/stages         Add stage
    PATCH  /api/routes/{project_id}/routes/{route_id}/stages/{stage_id}  Update stage
    DELETE /api/routes/{project_id}/routes/{route_id}/stages/{stage_id}  Delete stage (only if no experiments)
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models.project import Project
from app.models.route import Route, Stage
from app.models.user import User
from app.schemas.common import MessageResponse
from app.schemas.route import (
    RouteCreate, RouteResponse, RouteUpdate,
    StageCreate, StageResponse, StageUpdate,
)
from app.utils.audit import get_ip, log_action
from app.utils.deps import get_current_user, require_roles
from app.utils.privileges import require_privilege, PROJECTS_ROUTES

router = APIRouter()

_QA_HOD_TL = require_privilege(PROJECTS_ROUTES)

# ── Helpers ───────────────────────────────────────────────────────────────────

def _load_route(db: Session, project_id: str, route_id: str) -> Route:
    route = (
        db.query(Route)
        .options(selectinload(Route.stages))
        .filter(Route.id == route_id, Route.project_id == project_id)
        .first()
    )
    if not route:
        raise HTTPException(404, "Route not found")
    return route


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post(
    "/{project_id}/routes",
    response_model=RouteResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a synthesis route (with optional stages)",
)
def create_route(
    project_id: str,
    body:       RouteCreate,
    request:    Request,
    db:         Session = Depends(get_db),
    actor:      User    = Depends(_QA_HOD_TL),
):
    if not db.get(Project, project_id):
        raise HTTPException(404, "Project not found")

    route = Route(
        project_id  = project_id,
        code        = body.code.upper(),
        name        = body.name,
        description = body.description,
        sort_order  = body.sort_order,
        status      = "ACTIVE",
    )
    db.add(route)
    db.flush()

    # Create inline stages if provided
    for s in body.stages:
        db.add(Stage(
            route_id    = route.id,
            project_id  = project_id,
            code        = s.code.upper(),
            name        = s.name,
            description = s.description,
            sort_order  = s.sort_order,
            status      = "ACTIVE",
        ))

    log_action(
        db,
        user_id      = actor.id,
        username     = actor.username,
        module       = "Routes",
        action       = "CREATED",
        target_type  = "route",
        target_id    = route.id,
        target_label = route.code,
        detail       = f"Created route '{route.name}' with {len(body.stages)} stages",
        ip_address   = get_ip(request),
    )
    db.commit()
    return _load_route(db, project_id, route.id)


@router.get(
    "/{project_id}/routes",
    response_model=List[RouteResponse],
    summary="List routes for a project",
)
def list_routes(
    project_id: str,
    db: Session = Depends(get_db),
    _:  User    = Depends(get_current_user),
):
    return (
        db.query(Route)
        .options(selectinload(Route.stages))
        .filter(Route.project_id == project_id)
        .order_by(Route.sort_order, Route.code)
        .all()
    )


@router.get(
    "/{project_id}/routes/{route_id}",
    response_model=RouteResponse,
    summary="Get a single route with its stages",
)
def get_route(
    project_id: str,
    route_id:   str,
    db: Session = Depends(get_db),
    _:  User    = Depends(get_current_user),
):
    return _load_route(db, project_id, route_id)


@router.patch(
    "/{project_id}/routes/{route_id}",
    response_model=RouteResponse,
    summary="Update a route",
)
def update_route(
    project_id: str,
    route_id:   str,
    body:       RouteUpdate,
    request:    Request,
    db:         Session = Depends(get_db),
    actor:      User    = Depends(_QA_HOD_TL),
):
    route = _load_route(db, project_id, route_id)

    valid_statuses = {"ACTIVE", "DRAFT", "ARCHIVED"}
    if body.status and body.status.upper() not in valid_statuses:
        raise HTTPException(400, f"Invalid status. Use: {valid_statuses}")

    changed = []
    for field, value in body.model_dump(exclude_none=True).items():
        if field == "status":
            value = value.upper()
        if getattr(route, field) != value:
            changed.append(field)
        setattr(route, field, value)

    if changed:
        log_action(
            db,
            user_id      = actor.id,
            username     = actor.username,
            module       = "Routes",
            action       = "UPDATED",
            target_type  = "route",
            target_id    = route_id,
            target_label = route.code,
            detail       = f"Updated: {', '.join(changed)}",
            ip_address   = get_ip(request),
        )
        db.commit()
    return _load_route(db, project_id, route_id)


# ── Stages ────────────────────────────────────────────────────────────────────

@router.post(
    "/{project_id}/routes/{route_id}/stages",
    response_model=StageResponse,
    status_code=201,
    summary="Add a stage to a route",
)
def create_stage(
    project_id: str,
    route_id:   str,
    body:       StageCreate,
    db:         Session = Depends(get_db),
    actor:      User    = Depends(_QA_HOD_TL),
):
    route = _load_route(db, project_id, route_id)

    stage = Stage(
        route_id    = route.id,
        project_id  = project_id,
        code        = body.code.upper(),
        name        = body.name,
        description = body.description,
        sort_order  = body.sort_order,
        status      = "ACTIVE",
    )
    db.add(stage)
    db.commit()
    db.refresh(stage)
    return stage


@router.patch(
    "/{project_id}/routes/{route_id}/stages/{stage_id}",
    response_model=StageResponse,
    summary="Update a stage",
)
def update_stage(
    project_id: str,
    route_id:   str,
    stage_id:   str,
    body:       StageUpdate,
    db:         Session = Depends(get_db),
    actor:      User    = Depends(_QA_HOD_TL),
):
    stage = db.query(Stage).filter(
        Stage.id         == stage_id,
        Stage.route_id   == route_id,
        Stage.project_id == project_id,
    ).first()
    if not stage:
        raise HTTPException(404, "Stage not found")

    valid_statuses = {"ACTIVE", "DRAFT", "ARCHIVED"}
    if body.status and body.status.upper() not in valid_statuses:
        raise HTTPException(400, f"Invalid status. Use: {valid_statuses}")

    for field, value in body.model_dump(exclude_none=True).items():
        if field == "status":
            value = value.upper()
        setattr(stage, field, value)

    db.commit()
    db.refresh(stage)
    return stage


@router.delete(
    "/{project_id}/routes/{route_id}/stages/{stage_id}",
    response_model=MessageResponse,
    summary="Delete a stage (only if no experiments exist under it)",
)
def delete_stage(
    project_id: str,
    route_id:   str,
    stage_id:   str,
    db:         Session = Depends(get_db),
    actor:      User    = Depends(require_privilege(PROJECTS_ROUTES)),
):
    stage = db.query(Stage).filter(
        Stage.id         == stage_id,
        Stage.route_id   == route_id,
        Stage.project_id == project_id,
    ).first()
    if not stage:
        raise HTTPException(404, "Stage not found")

    # Safety check — do not delete stages with experiments
    from app.models.experiment import Experiment
    exp_count = db.query(Experiment).filter(Experiment.stage_id == stage_id).count()
    if exp_count:
        raise HTTPException(
            400,
            f"Cannot delete stage — {exp_count} experiment(s) are linked to it. Archive it instead.",
        )

    db.delete(stage)
    db.commit()
    return MessageResponse(message=f"Stage '{stage.code}' deleted")
