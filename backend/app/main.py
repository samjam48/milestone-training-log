from fastapi import Depends, FastAPI

from app.dependencies.session import require_session
from app.routers.activities import router as activities_router
from app.routers.activity_classes import router as activity_classes_router
from app.routers.activity_logs import router as activity_logs_router
from app.routers.auth import router as auth_router
from app.routers.daily_check_ins import router as daily_check_ins_router
from app.routers.dashboard import router as dashboard_router
from app.routers.flare_up_incidents import router as flare_up_incidents_router
from app.routers.goals import router as goals_router
from app.routers.health import router as health_router
from app.routers.load import router as load_router
from app.routers.mcp import router as mcp_router
from app.routers.recovery_targets import router as recovery_targets_router
from app.routers.rules import rules_router, training_block_rules_router
from app.routers.training_blocks import router as training_blocks_router
from app.routers.weekly_targets import (
    training_block_weekly_targets_router,
    weekly_targets_router,
)
from app.services.auth import validate_production_auth_settings
from app.settings import APP_VERSION, settings


def create_app() -> FastAPI:
    validate_production_auth_settings()
    app = FastAPI(title="Milestone Backend", version=APP_VERSION)
    session_required = [Depends(require_session)]

    app.include_router(health_router)
    app.include_router(auth_router)
    app.include_router(activity_classes_router, dependencies=session_required)
    app.include_router(activities_router, dependencies=session_required)
    app.include_router(activity_logs_router, dependencies=session_required)
    app.include_router(daily_check_ins_router, dependencies=session_required)
    app.include_router(flare_up_incidents_router, dependencies=session_required)
    app.include_router(goals_router, dependencies=session_required)
    app.include_router(training_blocks_router, dependencies=session_required)
    app.include_router(training_block_rules_router, dependencies=session_required)
    app.include_router(rules_router, dependencies=session_required)
    app.include_router(training_block_weekly_targets_router, dependencies=session_required)
    app.include_router(weekly_targets_router, dependencies=session_required)
    app.include_router(recovery_targets_router, dependencies=session_required)
    app.include_router(load_router, dependencies=session_required)
    app.include_router(dashboard_router, dependencies=session_required)
    app.include_router(mcp_router, dependencies=session_required)
    if settings.APP_DEV_MODE:
        from app.routers import dev as dev_router_module
        app.include_router(dev_router_module.router, prefix="/api")
    return app


app = create_app()
