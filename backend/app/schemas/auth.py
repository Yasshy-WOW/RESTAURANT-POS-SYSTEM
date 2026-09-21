from pydantic import Field

from app.schemas.common import CamelModel


class LoginRequest(CamelModel):
    # 担当者IDは数字4桁固定(決定事項No.13)
    staff_id: str = Field(pattern=r"^\d{4}$")
    # パスワードは1〜100文字(設計6章。複雑性要件は決定事項No.26により設けない)
    password: str = Field(min_length=1, max_length=100)


class LoginResponse(CamelModel):
    token: str
    role: str


class MeResponse(CamelModel):
    staff_id: str
    role: str
