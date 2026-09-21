from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import auth, health, members, menus, staff, tax_rate, transactions
from app.core.config import settings
from app.core.errors import APIError

app = FastAPI(
    title="簡易POSアプリ API",
    # Swagger/ReDoc/OpenAPIはローカル開発時のみ公開する(設計仕様書5.5節)
    docs_url="/docs" if settings.env == "local" else None,
    redoc_url="/redoc" if settings.env == "local" else None,
    openapi_url="/openapi.json" if settings.env == "local" else None,
)

# CORS(設計仕様書5.3節)。多層防御としてFastAPI側にも設定するが、
# 通常運用ではブラウザはNext.js(BFF)としか通信しない。
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allow_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.exception_handler(APIError)
def handle_api_error(_: Request, exc: APIError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"error_code": exc.error_code, "message": exc.message, "details": exc.details},
    )


@app.exception_handler(RequestValidationError)
def handle_validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
    """Pydanticバリデーション失敗を設計仕様書7章の共通エラーフォーマットに統一する。"""
    return JSONResponse(
        status_code=422,
        content={
            "error_code": "VALIDATION_ERROR",
            "message": "入力値が型・桁数・パターン要件を満たしていません。",
            "details": {"errors": jsonable_encoder(exc.errors())},
        },
    )


@app.exception_handler(Exception)
def handle_unexpected_error(_: Request, exc: Exception) -> JSONResponse:
    """想定外のサーバーエラー(設計仕様書7.2/7.3節: INTERNAL_ERROR, 500)。

    購入確定時にDB保存が失敗した場合など(要件3.6節・決定事項No.29)、
    ここで500を返す。フロントエンドは購入リストをクリアせず保持し再試行できる
    (各リクエストは独立したDBセッションで処理されるため、保存失敗時に
    ハンドラ側で明示的なロールバックをしなくても、次のリクエストは
    新しいセッションでクリーンな状態から再試行できる)。
    """
    return JSONResponse(
        status_code=500,
        content={"error_code": "INTERNAL_ERROR", "message": "サーバー内部でエラーが発生しました。", "details": {}},
    )


# 8章の全エンドポイントは/apiをベースパスとして付与する(健康チェックのみ例外)
app.include_router(auth.router, prefix="/api")
app.include_router(members.router, prefix="/api")
app.include_router(menus.router, prefix="/api")
app.include_router(staff.router, prefix="/api")
app.include_router(tax_rate.router, prefix="/api")
app.include_router(transactions.router, prefix="/api")
app.include_router(health.router)
