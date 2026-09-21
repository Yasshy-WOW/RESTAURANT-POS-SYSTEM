from datetime import datetime

from pydantic import Field

from app.schemas.common import CamelModel


class MenuLookupOut(CamelModel):
    """メニュー検索(GET /menus/{menuNo})の出力(要件3.3.1)。"""

    menu_no: str
    name: str
    price: int


class MenuCreate(CamelModel):
    # メニュー名は1〜50文字(決定事項No.32)
    name: str = Field(min_length=1, max_length=50)
    # 単価は1円以上の正の整数(決定事項No.31)。上限999,999円は設計6章の設計決定
    price: int = Field(ge=1, le=999_999)


class MenuUpdate(CamelModel):
    name: str | None = Field(default=None, min_length=1, max_length=50)
    price: int | None = Field(default=None, ge=1, le=999_999)
    is_active: bool | None = None


class MenuCreateOut(CamelModel):
    menu_no: str


class MenuOut(CamelModel):
    """マスタメンテナンス一覧・編集用のメニュー情報。"""

    menu_no: str
    name: str
    price: int
    is_active: bool
    created_at: datetime
    updated_at: datetime


class MenuListOut(CamelModel):
    menus: list[MenuOut]
