from pydantic import BaseModel, ConfigDict, Field


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    password: str = Field(min_length=1)


class LoginResponse(BaseModel):
    ok: bool = True


class MeResponse(BaseModel):
    ok: bool = True
