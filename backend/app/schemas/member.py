from datetime import datetime
from typing import Literal

from pydantic import Field

from app.schemas.common import CamelModel

GenderLiteral = Literal["MALE", "FEMALE", "OTHER", "NO_ANSWER"]


class MemberLookupOut(CamelModel):
    """会員照会(GET /members/{memberId})の出力。氏名等は返さない(決定事項No.20)。"""

    member_id: str


class MemberCreate(CamelModel):
    # 会員登録項目の必須・妥当性チェックは要件化されていないが、
    # 設計仕様書6章で定義された上下限に従う(決定事項No.34)。
    name: str = Field(min_length=1, max_length=50)
    phone: str = Field(min_length=10, max_length=13, pattern=r"^[0-9-]+$")
    address: str = Field(min_length=1, max_length=200)
    gender: GenderLiteral
    age: int = Field(ge=0, le=120)


class MemberUpdate(CamelModel):
    name: str | None = Field(default=None, min_length=1, max_length=50)
    phone: str | None = Field(default=None, min_length=10, max_length=13, pattern=r"^[0-9-]+$")
    address: str | None = Field(default=None, min_length=1, max_length=200)
    gender: GenderLiteral | None = None
    age: int | None = Field(default=None, ge=0, le=120)
    is_active: bool | None = None


class MemberCreateOut(CamelModel):
    member_id: str


class MemberOut(CamelModel):
    """マスタメンテナンス一覧・編集用の会員情報。"""

    member_id: str
    name: str
    phone: str
    address: str
    gender: GenderLiteral
    age: int
    is_active: bool
    created_at: datetime
    updated_at: datetime


class MemberListOut(CamelModel):
    members: list[MemberOut]
