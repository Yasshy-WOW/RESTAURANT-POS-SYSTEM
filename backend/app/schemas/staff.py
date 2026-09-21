from datetime import datetime
from typing import Literal

from pydantic import Field

from app.schemas.common import CamelModel

RoleLiteral = Literal["GENERAL", "ADMIN"]


class StaffCreate(CamelModel):
    # パスワードは1〜100文字、空文字は不可(決定事項No.33、設計6章)
    password: str = Field(min_length=1, max_length=100)
    role: RoleLiteral


class StaffUpdate(CamelModel):
    password: str | None = Field(default=None, min_length=1, max_length=100)
    role: RoleLiteral | None = None
    is_active: bool | None = None


class StaffCreateOut(CamelModel):
    staff_id: str


class StaffOut(CamelModel):
    """マスタメンテナンス一覧用の担当者情報。パスワードハッシュは含めない。"""

    staff_id: str
    role: RoleLiteral
    is_active: bool
    created_at: datetime
    updated_at: datetime


class StaffListOut(CamelModel):
    staff: list[StaffOut]
