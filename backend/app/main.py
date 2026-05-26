from fastapi import FastAPI

from app.routers.health import router as health_router
from app.settings import APP_VERSION


def create_app() -> FastAPI:
    app = FastAPI(title="Milestone Backend", version=APP_VERSION)
    app.include_router(health_router)
    return app


app = create_app()
