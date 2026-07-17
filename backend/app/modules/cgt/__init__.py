"""CGT (Cell and Gene Therapy) module – exports routers for registration in main.py."""
from app.modules.cgt.projects import router as cgt_projects_router
from app.modules.cgt.notebooks import router as cgt_notebooks_router, nb_sub_router as cgt_notebooks_sub_router
from app.modules.cgt.experiments import router as cgt_experiments_nb_router, exp_router as cgt_experiments_router

__all__ = [
    "cgt_projects_router",
    "cgt_notebooks_router", "cgt_notebooks_sub_router",
    "cgt_experiments_nb_router", "cgt_experiments_router",
]
