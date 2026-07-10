"""CGT (Cell and Gene Therapy) module – exports routers for registration in main.py."""
from app.modules.cgt.projects import router as cgt_projects_router

__all__ = ["cgt_projects_router"]
