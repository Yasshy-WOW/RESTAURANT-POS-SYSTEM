from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict[str, str]:
    """Azureのヘルスチェック/死活監視用(設計仕様書8.7節)。DBアクセスは行わない。"""
    return {"status": "ok"}
