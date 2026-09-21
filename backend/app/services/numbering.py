from app.core.errors import ValidationErrorAPI

STAFF_ID_WIDTH = 4
MEMBER_ID_WIDTH = 8
MENU_NO_WIDTH = 4


def format_id(value: int, width: int) -> str:
    """自動採番されたint PKを固定桁のゼロ埋め文字列に変換する(例: 1 -> "0001")。"""
    return str(value).zfill(width)


def parse_id(raw: str, width: int, field_name: str) -> int:
    """固定桁の数字文字列をint PKに変換する。桁数不一致・数字以外はVALIDATION_ERRORとする。"""
    if len(raw) != width or not raw.isdigit():
        raise ValidationErrorAPI(
            message=f"{field_name}は数字{width}桁で指定してください。",
            details={"field": field_name, "value": raw},
        )
    return int(raw)


def ensure_within_range(value: int, width: int, field_name: str) -> None:
    """採番結果が固定桁数の範囲(例: 4桁なら0001〜9999)に収まっているか防御的に確認する。

    要件・設計に明記はないが、桁数上限を超えて採番されるとID体系(4桁/8桁固定)が
    崩れるため、上限到達時は明確なエラーとして扱う。
    """
    max_value = (10**width) - 1
    if value < 1 or value > max_value:
        raise ValidationErrorAPI(
            message=f"{field_name}の採番可能数の上限に達しています。",
            details={"field": field_name},
        )
