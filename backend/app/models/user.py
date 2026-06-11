from datetime import datetime
from typing import List, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, SmallInteger, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, PUUID, new_uuid, now_utc

VALID_ROLES = {"QA", "HOD", "TL", "CHEM", "ARD_TL", "ARD_ANALYST", "ARD_HOD"}  # FIX-51: ARD roles


class Role(Base):
    __tablename__ = "roles"

    id:          Mapped[str]           = mapped_column(PUUID, primary_key=True, default=new_uuid)
    code:        Mapped[str]           = mapped_column(String(20), unique=True, nullable=False)
    name:        Mapped[str]           = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    is_active:   Mapped[bool]          = mapped_column(Boolean, default=True, nullable=False)
    created_at:  Mapped[datetime]      = mapped_column(DateTime(timezone=True), default=now_utc)

    privileges: Mapped[List["RolePrivilege"]] = relationship(back_populates="role")


class RolePrivilege(Base):
    __tablename__ = "role_privileges"

    id:            Mapped[str]           = mapped_column(PUUID, primary_key=True, default=new_uuid)
    role_id:       Mapped[str]           = mapped_column(PUUID, ForeignKey("roles.id"), nullable=False)
    department_id: Mapped[Optional[str]] = mapped_column(PUUID, ForeignKey("departments.id"))
    privilege_key: Mapped[str]           = mapped_column(String(50), nullable=False)
    is_granted:    Mapped[bool]          = mapped_column(Boolean, nullable=False, default=True)
    updated_by:    Mapped[Optional[str]] = mapped_column(PUUID, ForeignKey("users.id", ondelete="SET NULL"))
    updated_at:    Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    role:         Mapped["Role"]          = relationship(back_populates="privileges")
    updated_user: Mapped[Optional["User"]] = relationship(foreign_keys="RolePrivilege.updated_by")


class User(Base):
    __tablename__ = "users"

    id:              Mapped[str]  = mapped_column(PUUID, primary_key=True, default=new_uuid)
    username:        Mapped[str]  = mapped_column(String(50), unique=True, nullable=False)
    emp_no:          Mapped[str]  = mapped_column(String(20), unique=True, nullable=False)
    title:           Mapped[Optional[str]] = mapped_column(String(10))
    first_name:      Mapped[str]  = mapped_column(String(100), nullable=False)
    middle_initials: Mapped[Optional[str]] = mapped_column(String(20))              # FIX-53
    last_name:       Mapped[str]  = mapped_column(String(100), nullable=False)
    display_name:    Mapped[str]  = mapped_column(String(150), nullable=False)
    email:           Mapped[str]  = mapped_column(String(255), unique=True, nullable=False)
    password_hash:   Mapped[str]  = mapped_column(String(255), nullable=False)
    role_id:         Mapped[str]  = mapped_column(PUUID, ForeignKey("roles.id"), nullable=False)
    designation:         Mapped[Optional[str]] = mapped_column(String(100))
    contact_no:          Mapped[Optional[str]] = mapped_column(String(30))          # FIX-53
    department_id:       Mapped[Optional[str]] = mapped_column(PUUID, ForeignKey("departments.id"))
    site:                Mapped[Optional[str]] = mapped_column(String(100))         # FIX-37/55: physical site
    dashboard_reference: Mapped[Optional[str]] = mapped_column(String(100))         # FIX-55
    allow_settings_update: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)  # FIX-55
    is_active:           Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_login_at:       Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    failed_login_count:  Mapped[int] = mapped_column(SmallInteger, default=0, nullable=False)
    locked_until:        Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    must_reset_password: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)  # FIX-53
    created_at:          Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at:          Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    role:            Mapped["Role"]                  = relationship(foreign_keys=[role_id])
    department:      Mapped[Optional["Department"]]  = relationship(foreign_keys=[department_id])
    reset_tokens:    Mapped[List["PasswordResetToken"]] = relationship(back_populates="user")
    refresh_tokens:  Mapped[List["RefreshToken"]]       = relationship(back_populates="user")


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id:         Mapped[str] = mapped_column(PUUID, primary_key=True, default=new_uuid)
    user_id:    Mapped[str] = mapped_column(PUUID, ForeignKey("users.id"), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at:    Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    user: Mapped["User"] = relationship(back_populates="reset_tokens")


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id:         Mapped[str] = mapped_column(PUUID, primary_key=True, default=new_uuid)
    user_id:    Mapped[str] = mapped_column(PUUID, ForeignKey("users.id"), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    ip_address: Mapped[Optional[str]] = mapped_column(String(45))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    user: Mapped["User"] = relationship(back_populates="refresh_tokens")


# Avoid circular import — Department is defined in department.py
from app.models.department import Department  # noqa: E402
