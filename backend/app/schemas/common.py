"""
Shared Pydantic schemas used across all modules.
"""
from typing import Generic, List, TypeVar
from pydantic import BaseModel, ConfigDict

DataT = TypeVar("DataT")


class PaginatedResponse(BaseModel, Generic[DataT]):
    """
    Standard paginated list wrapper.

    Usage:
        response_model=PaginatedResponse[UserResponse]
    """
    items:     List[DataT]
    total:     int
    page:      int
    page_size: int
    pages:     int

    model_config = ConfigDict(from_attributes=True)


class MessageResponse(BaseModel):
    """Simple success message."""
    message: str


class IDResponse(BaseModel):
    """Return the id of a newly created record."""
    id: str


def paginate(query_count: int, page: int, page_size: int) -> dict:
    """
    Helper — compute pagination metadata.

    Args:
        query_count: total rows matched by the filter
        page:        current page (1-based)
        page_size:   rows per page

    Returns:
        dict with keys: total, page, page_size, pages
        (pass **paginate(...) into PaginatedResponse)
    """
    import math
    pages = math.ceil(query_count / page_size) if query_count else 0
    return {
        "total":     query_count,
        "page":      page,
        "page_size": page_size,
        "pages":     pages,
    }
