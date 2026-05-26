from fastapi import FastAPI

from app.settings import APP_VERSION


def create_app() -> FastAPI:
    return FastAPI(title="Milestone Backend", version=APP_VERSION)


app = create_app()
