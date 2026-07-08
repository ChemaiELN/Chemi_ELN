import uuid
import datetime
from sqlalchemy import (
    Column, String, Boolean, Integer, Text,
    DateTime, ForeignKey, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


def _uuid():
    return uuid.uuid4()


def _now():
    return datetime.datetime.utcnow()


class Role(Base):
    __tablename__ = "roles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    code = Column(String(20), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=_now)

    users = relationship("User", back_populates="role")
    role_privileges = relationship("RolePrivilege", back_populates="role", cascade="all, delete-orphan")


class Department(Base):
    __tablename__ = "departments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    code = Column(String(20), unique=True, nullable=False)
    name = Column(String(150), nullable=False)
    description = Column(String(500), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    # use_alter so Alembic emits ADD CONSTRAINT after both tables exist
    created_by = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL", use_alter=True, name="fk_departments_created_by"),
        nullable=True,
    )
    created_at = Column(DateTime, nullable=False, default=_now)
    updated_at = Column(DateTime, nullable=False, default=_now, onupdate=_now)

    users = relationship("User", back_populates="department", foreign_keys="User.department_id")
    creator = relationship("User", foreign_keys=[created_by], primaryjoin="Department.created_by == User.id")


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    username = Column(String(100), unique=True, nullable=False)
    emp_no = Column(String(50), unique=True, nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role_id = Column(UUID(as_uuid=True), ForeignKey("roles.id"), nullable=False)
    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    failed_login_count = Column(Integer, nullable=False, default=0)
    locked_until = Column(DateTime, nullable=True)
    must_reset_password = Column(Boolean, nullable=False, default=False)
    allow_settings_update = Column(Boolean, nullable=False, default=False)
    site = Column(String(100), nullable=True)
    dashboard_reference = Column(String(255), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=_now)
    updated_at = Column(DateTime, nullable=False, default=_now, onupdate=_now)

    role = relationship("Role", back_populates="users")
    department = relationship("Department", back_populates="users", foreign_keys=[department_id])


class DepartmentRoleMapping(Base):
    """Which roles are selectable for a given department in the Users admin UI."""
    __tablename__ = "department_role_mapping"
    __table_args__ = (UniqueConstraint("department_id", "role_id", name="uq_dept_role_mapping"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id", ondelete="CASCADE"), nullable=False)
    role_id = Column(UUID(as_uuid=True), ForeignKey("roles.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, nullable=False, default=_now)

    department = relationship("Department")
    role = relationship("Role")


class RolePrivilege(Base):
    __tablename__ = "role_privileges"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    role_id = Column(UUID(as_uuid=True), ForeignKey("roles.id"), nullable=False)
    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    privilege_key = Column(String(50), nullable=False)
    is_granted = Column(Boolean, nullable=False, default=True)
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_at = Column(DateTime, nullable=False, default=_now, onupdate=_now)

    role = relationship("Role", back_populates="role_privileges")
