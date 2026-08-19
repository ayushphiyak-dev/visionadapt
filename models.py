"""
models.py
---------
Pydantic request/response schemas for the VisionAdapt API.
"""
from pydantic import BaseModel, Field
from typing import Optional


class RegisterRequest(BaseModel):
    email: str = Field(..., description="User email address")
    password: str = Field(..., min_length=6, description="Password (min 6 chars)")
    display_name: Optional[str] = Field(None, description="Optional display name")


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class PredictionRequest(BaseModel):
    image_url: str = Field(..., description="URL or base64-encoded image to classify")
    model: Optional[str] = Field(
        default="google/vit-base-patch16-224",
        description="HuggingFace model ID to use"
    )


class PredictionResponse(BaseModel):
    status: str
    authenticated_user: str
    predictions: list | dict | str
    source: str = "hf_api"
    model_used: str


class HealthResponse(BaseModel):
    status: str
    version: str
    hf_api_configured: bool
    local_model_loaded: bool


class MetricsResponse(BaseModel):
    axis_classifier: dict
    severity_regressor: dict
    inference: dict
    dataset: dict
