import uuid
import datetime
from sqlalchemy import (
    Column, String, Boolean, Integer, SmallInteger, Text, Date,
    DateTime, BigInteger, ForeignKey,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


def _uuid():
    return uuid.uuid4()


def _now():
    return datetime.datetime.utcnow()


class Project(Base):
    __tablename__ = "projects"

    id                       = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    code                     = Column(String(20), unique=True, nullable=False)
    name                     = Column(String(255), nullable=False)
    product_name             = Column(String(255), nullable=True)
    in_house_project_id      = Column(String(100), nullable=True)
    project_type             = Column(String(20), nullable=True)
    market                   = Column(String(50), nullable=True)
    department_id            = Column(UUID(as_uuid=True), ForeignKey("departments.id"), nullable=True)
    manager_id               = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_by               = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    start_date               = Column(Date, nullable=True)
    target_date              = Column(Date, nullable=True)
    status                   = Column(String(20), default="ACTIVE", nullable=False)
    description              = Column(Text, nullable=True)
    objective                = Column(Text, nullable=True)
    observation              = Column(Text, nullable=True)
    remarks                  = Column(Text, nullable=True)
    related_docs_comments    = Column(Text, nullable=True)
    related_docs_observations = Column(Text, nullable=True)

    # ADC-specific
    customer             = Column(String(200), nullable=True)
    adc_code             = Column(String(100), nullable=True)
    target_antigen       = Column(String(200), nullable=True)
    antibody_clone       = Column(String(200), nullable=True)
    payload              = Column(String(300), nullable=True)
    linker               = Column(String(200), nullable=True)
    target_dar           = Column(String(50), nullable=True)
    project_stage        = Column(String(50), nullable=True)
    qa_review_required   = Column(Boolean, nullable=True)

    # Regulatory
    oel_band                 = Column(String(100), nullable=True)
    containment_category     = Column(String(100), nullable=True)
    gmp_non_gmp              = Column(String(20), nullable=True)
    regulatory_observations  = Column(Text, nullable=True)

    # Scheme (Ketcher)
    scheme_data = Column(Text, nullable=True)

    created_at = Column(DateTime, nullable=False, default=_now)
    updated_at = Column(DateTime, nullable=False, default=_now, onupdate=_now)

    department      = relationship("Department", foreign_keys=[department_id])
    manager         = relationship("User", foreign_keys=[manager_id])
    creator         = relationship("User", foreign_keys=[created_by])
    project_users   = relationship("ProjectUser", back_populates="project", cascade="all, delete-orphan")
    milestones      = relationship("Milestone", back_populates="project", cascade="all, delete-orphan")
    routes          = relationship("Route", back_populates="project", cascade="all, delete-orphan")
    attachments     = relationship("ProjectAttachment", back_populates="project", cascade="all, delete-orphan")
    risk_assessment = relationship("ProjectRiskAssessment", back_populates="project", uselist=False, cascade="all, delete-orphan")
    notebooks       = relationship("Notebook", back_populates="project")


# ── Project Code Counter — global per year (ADC/{YY}/{SEQ}) ───────────────────
class ProjectCodeCounter(Base):
    __tablename__ = "project_code_counter"
    year     = Column(String(2), primary_key=True)
    last_seq = Column(Integer, nullable=False, default=30000)


class ProjectUser(Base):
    __tablename__ = "project_users"

    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), primary_key=True)
    user_id    = Column(UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True)
    role       = Column(String(50), nullable=True)
    added_at   = Column(DateTime, nullable=False, default=_now)
    added_by   = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    project = relationship("Project", back_populates="project_users")
    user    = relationship("User", foreign_keys=[user_id])


class Route(Base):
    __tablename__ = "routes"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    project_id  = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    code        = Column(String(10), nullable=False)
    name        = Column(String(255), nullable=False)
    description = Column(String(500), nullable=True)
    sort_order  = Column(SmallInteger, default=1, nullable=False)
    status      = Column(String(20), default="ACTIVE", nullable=False)
    created_at  = Column(DateTime, nullable=False, default=_now)
    updated_at  = Column(DateTime, nullable=False, default=_now, onupdate=_now)

    project = relationship("Project", back_populates="routes")
    stages  = relationship("Stage", back_populates="route", cascade="all, delete-orphan")


class Stage(Base):
    __tablename__ = "stages"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    route_id    = Column(UUID(as_uuid=True), ForeignKey("routes.id"), nullable=False)
    project_id  = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    code        = Column(String(10), nullable=False)
    name        = Column(String(255), nullable=False)
    description = Column(String(500), nullable=True)
    sort_order  = Column(SmallInteger, default=1, nullable=False)
    status      = Column(String(20), default="ACTIVE", nullable=False)
    created_at  = Column(DateTime, nullable=False, default=_now)
    updated_at  = Column(DateTime, nullable=False, default=_now, onupdate=_now)

    route   = relationship("Route", back_populates="stages")
    project = relationship("Project", foreign_keys=[project_id])


class Milestone(Base):
    __tablename__ = "milestones"

    id             = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    project_id     = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    name           = Column(String(255), nullable=False)
    due_date       = Column(Date, nullable=True)
    completed_date = Column(Date, nullable=True)
    owner_id       = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    status         = Column(String(20), default="NOT STARTED", nullable=False)
    pct            = Column(SmallInteger, default=0, nullable=False)
    created_at     = Column(DateTime, nullable=False, default=_now)

    project     = relationship("Project", back_populates="milestones")
    owner       = relationship("User", foreign_keys=[owner_id])
    attachments = relationship("MilestoneAttachment", back_populates="milestone", cascade="all, delete-orphan")


class ProjectAttachment(Base):
    __tablename__ = "project_attachments"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    project_id  = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    filename    = Column(String(255), nullable=False)
    file_path   = Column(String(500), nullable=False)
    file_size   = Column(BigInteger, nullable=True)
    file_type   = Column(String(50), nullable=True)
    comments    = Column(Text, nullable=True)
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    uploaded_at = Column(DateTime, nullable=False, default=_now)

    project  = relationship("Project", back_populates="attachments")
    uploader = relationship("User", foreign_keys=[uploaded_by])


class MilestoneAttachment(Base):
    __tablename__ = "milestone_attachments"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    milestone_id = Column(UUID(as_uuid=True), ForeignKey("milestones.id"), nullable=False)
    filename     = Column(String(255), nullable=False)
    file_path    = Column(String(500), nullable=False)
    file_size    = Column(BigInteger, nullable=True)
    file_type    = Column(String(50), nullable=True)
    uploaded_by  = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    uploaded_at  = Column(DateTime, nullable=False, default=_now)

    milestone = relationship("Milestone", back_populates="attachments")
    uploader  = relationship("User", foreign_keys=[uploaded_by])


class ProjectRiskAssessment(Base):
    __tablename__ = "project_risk_assessments"

    id                 = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    project_id         = Column(UUID(as_uuid=True), ForeignKey("projects.id"), unique=True, nullable=False)
    assessment_id      = Column(String(100), nullable=True)
    assessment_type    = Column(String(50), nullable=True)
    last_reviewed      = Column(DateTime, nullable=True)
    reviewed_by        = Column(String(200), nullable=True)
    overall_risk_level = Column(String(20), nullable=True)
    status             = Column(String(50), nullable=True)
    additional_notes   = Column(Text, nullable=True)
    observations       = Column(Text, nullable=True)
    created_at         = Column(DateTime, nullable=False, default=_now)
    updated_at         = Column(DateTime, nullable=False, default=_now, onupdate=_now)

    project = relationship("Project", back_populates="risk_assessment")
    rows    = relationship("ProjectRiskRow", back_populates="assessment", cascade="all, delete-orphan", order_by="ProjectRiskRow.sort_order")


class ProjectRiskRow(Base):
    __tablename__ = "project_risk_rows"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    assessment_id = Column(UUID(as_uuid=True), ForeignKey("project_risk_assessments.id"), nullable=False)
    sort_order    = Column(Integer, default=0, nullable=False)
    process_step  = Column(Text, nullable=True)
    failure_mode  = Column(Text, nullable=True)
    severity      = Column(SmallInteger, nullable=True)
    occurrence    = Column(SmallInteger, nullable=True)
    detection     = Column(SmallInteger, nullable=True)
    mitigation    = Column(Text, nullable=True)
    created_at    = Column(DateTime, nullable=False, default=_now)

    assessment = relationship("ProjectRiskAssessment", back_populates="rows")
