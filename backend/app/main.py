from fastapi import FastAPI

from app.routers.activities import router as activities_router
from app.routers.activity_classes import router as activity_classes_router
from app.routers.activity_logs import router as activity_logs_router
from app.routers.daily_check_ins import router as daily_check_ins_router
from app.routers.health import router as health_router
from app.settings import APP_VERSION


def create_app() -> FastAPI:
    app = FastAPI(title="Milestone Backend", version=APP_VERSION)
    app.include_router(health_router)
    app.include_router(activity_classes_router)
    app.include_router(activities_router)
    app.include_router(activity_logs_router)
    app.include_router(daily_check_ins_router)
    return app


app = create_app()
