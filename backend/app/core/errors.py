from typing import Any


class APIError(Exception):
    """設計仕様書7章のエラーレスポンス共通フォーマットに対応する例外。"""

    def __init__(self, status_code: int, error_code: str, message: str, details: dict[str, Any] | None = None):
        self.status_code = status_code
        self.error_code = error_code
        self.message = message
        self.details = details or {}
        super().__init__(message)


# 7.3節 主なエラーコード一覧
class AuthInvalidCredentials(APIError):
    def __init__(self) -> None:
        super().__init__(401, "AUTH_INVALID_CREDENTIALS", "担当者IDまたはパスワードが誤っています。")


class AuthTokenExpired(APIError):
    def __init__(self) -> None:
        super().__init__(401, "AUTH_TOKEN_EXPIRED", "認証の有効期限が切れています。再度ログインしてください。")


class AuthForbidden(APIError):
    def __init__(self) -> None:
        super().__init__(403, "AUTH_FORBIDDEN", "この操作を行う権限がありません。")


class MemberNotFound(APIError):
    def __init__(self) -> None:
        super().__init__(404, "MEMBER_NOT_FOUND", "指定された会員IDは登録されていません。")


class MenuNotFound(APIError):
    def __init__(self) -> None:
        super().__init__(404, "MENU_NOT_FOUND", "指定されたメニュー番号は登録されていません。")


class StaffNotFound(APIError):
    def __init__(self) -> None:
        super().__init__(404, "STAFF_NOT_FOUND", "指定された担当者IDは登録されていません。")


class TransactionNotFound(APIError):
    def __init__(self) -> None:
        super().__init__(404, "TRANSACTION_NOT_FOUND", "指定された取引は存在しません。")


class MenuDeletedInCart(APIError):
    def __init__(self, details: dict[str, Any] | None = None) -> None:
        super().__init__(
            409,
            "MENU_DELETED_IN_CART",
            "購入リストに削除済みのメニューが含まれているため、購入を確定できません。",
            details,
        )


class CalculationMismatch(APIError):
    def __init__(self, details: dict[str, Any] | None = None) -> None:
        super().__init__(
            409,
            "CALCULATION_MISMATCH",
            "合計金額の計算結果が一致しないため、購入を確定できません。",
            details,
        )


class LastAdminProtection(APIError):
    def __init__(self) -> None:
        super().__init__(
            409,
            "LAST_ADMIN_PROTECTION",
            "最後の1人の管理者は削除・一般担当者への降格ができません。",
        )


class ValidationErrorAPI(APIError):
    def __init__(self, message: str = "入力値が不正です。", details: dict[str, Any] | None = None) -> None:
        super().__init__(422, "VALIDATION_ERROR", message, details)


class InternalError(APIError):
    def __init__(self) -> None:
        super().__init__(500, "INTERNAL_ERROR", "サーバー内部でエラーが発生しました。")
