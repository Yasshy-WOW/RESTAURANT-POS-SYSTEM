import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db.base import Base


class StaffRole(str, enum.Enum):
    GENERAL = "GENERAL"
    ADMIN = "ADMIN"


class Staff(Base):
    """担当者マスタ(要件3.1/3.8, 決定事項No.10・13・18・22)。"""

    __tablename__ = "staff"

    staff_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[StaffRole] = mapped_column(Enum(StaffRole), nullable=False, default=StaffRole.GENERAL)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
