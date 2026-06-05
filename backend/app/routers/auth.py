from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.dependencies.session import SessionUserId, require_session
from app.schemas.auth import LoginRequest, LoginResponse, MeResponse
from app.services import auth as auth_service

router = APIRouter(prefix="/api/auth", tags=["auth"])

SessionDep = Annotated[SessionUserId, Depends(require_session)]


@router.post("/login", response_model=LoginResponse)
async def post_login(payload: LoginRequest, response: Response) -> LoginResponse:
    if not auth_service.verify_password(payload.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized",
        )

    token = auth_service.create_session_token()
    auth_service.set_session_cookie(response, token)
    return LoginResponse()


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def post_logout(response: Response, _session: SessionDep) -> None:
    auth_service.clear_session_cookie(response)


@router.get("/me", response_model=MeResponse)
async def get_me(_session: SessionDep) -> MeResponse:
    return MeResponse()
