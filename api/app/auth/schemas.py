from pydantic import BaseModel, EmailStr, Field

from app.users.schemas import UserBase


class SignupRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    email: EmailStr = Field(max_length=255)
    password: str = Field(min_length=8, max_length=128)


class SignupResponse(UserBase):
    pass


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(UserBase):
    pass


class MeResponse(UserBase):
    pass
