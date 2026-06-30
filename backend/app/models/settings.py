from sqlalchemy import Column, Integer, String, Boolean, CheckConstraint
from app.database import Base


class GlobalSettings(Base):
    __tablename__ = "global_settings"
    __table_args__ = (
        CheckConstraint("id = 1", name="ck_global_settings_singleton"),
    )

    id = Column(Integer, primary_key=True, default=1)
    auth_type = Column(String(50), nullable=False, default="Application")
    lock_user_after_x_attempts = Column(Integer, nullable=False, default=5)
    password_expiry_days = Column(Integer, nullable=False, default=90)
    max_image_kb = Column(Integer, nullable=False, default=2048)
    max_attachment_kb = Column(Integer, nullable=False, default=51200)
    experiments_per_notebook = Column(Integer, nullable=False, default=999)
    notebooks_per_project = Column(Integer, nullable=False, default=999)
    search_limit = Column(Integer, nullable=False, default=100)
    qa_role = Column(String(20), nullable=True)
    smtp_host = Column(String(255), nullable=True)
    smtp_port = Column(Integer, nullable=True, default=587)
    smtp_from_address = Column(String(255), nullable=True)
    smtp_username = Column(String(255), nullable=True)
    smtp_password = Column(String(255), nullable=True)
    enable_email_notifications = Column(Boolean, nullable=False, default=False)
