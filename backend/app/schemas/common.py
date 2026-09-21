from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    """API入出力はcamelCase(設計仕様書8章の例: staffId, menuNo等)、
    内部実装はPython慣習のsnake_caseとするための基底モデル。
    """

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)


class ErrorResponse(BaseModel):
    """設計仕様書7.1節のエラーレスポンス共通フォーマット。"""

    error_code: str
    message: str
    details: dict = {}
