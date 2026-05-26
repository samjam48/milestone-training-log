from fastapi import APIRouter

from app.settings import settings

router = APIRouter()


@router.get("/api/health")
async def get_health() -> dict[str, str]:
    return {"status": "ok", "version": settings.APP_VERSION}
