from pydantic import BaseModel, Field, EmailStr
from typing import Optional, Union
from enum import Enum


class CVDType(str, Enum):
    protanomaly = "Protanomaly"
    protanopia = "Protanopia"
    deuteranomaly = "Deuteranomaly"
    deuteranopia = "Deuteranopia"
    tritanomaly = "Tritanomaly"
    tritanopia = "Tritanopia"
    typical = "Typical color vision"


class RegisterRequest(BaseModel):
    email: EmailStr = Field(..., description="Valid email address")
    password: str = Field(..., min_length=6, max_length=128, description="Password (6-128 chars)")
    display_name: Optional[str] = Field(None, max_length=64, description="Optional display name")


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserPublic"


class UserPublic(BaseModel):
    email: str
    display_name: str


class PredictionRequest(BaseModel):
    image_url: str = Field(..., min_length=1, max_length=2048, description="URL or base64 image")
    model: Optional[str] = Field(
        default="google/vit-base-patch16-224",
        max_length=200,
        description="HuggingFace model ID",
    )


class PredictionResponse(BaseModel):
    status: str
    authenticated_user: str
    predictions: Union[list, dict, str]
    source: str = "hf_api"
    model_used: str
    latency_ms: Optional[float] = None


class CVDProfile(BaseModel):
    type: CVDType = Field(default=CVDType.typical)
    severity: float = Field(default=0, ge=0, le=100)
    contrast: int = Field(default=50, ge=0, le=100)
    outline: int = Field(default=2, ge=0, le=8)


class ProfileSaveRequest(BaseModel):
    cvd_type: str = Field(..., max_length=64, description="CVD type label")
    severity: float = Field(..., ge=0, le=100, description="Severity 0-100")
    contrast: int = Field(default=50, ge=0, le=100)
    outline: int = Field(default=2, ge=0, le=8)
    icon_pref: str = Field(default="Symbols", max_length=32)
    feature_vector: Optional[list[float]] = Field(None, description="12-dim feature vector from assessment")
    model_used: Optional[bool] = Field(default=False, description="Whether ML model was used")
    model_confidence: Optional[float] = Field(None, description="ML model confidence")
    model_latency_ms: Optional[float] = Field(None, description="ML inference latency")


class ProfileResponse(BaseModel):
    cvd_type: str
    severity: float
    contrast: int
    outline: int
    icon_pref: str
    model_used: bool
    model_confidence: Optional[float]
    model_latency_ms: Optional[float]
    updated_at: float


class ExtensionStatusRequest(BaseModel):
    connected: bool = False
    game: Optional[str] = Field(None, max_length=128)
    fps: Optional[int] = Field(None, ge=0, le=1000)
    canvas_count: int = Field(default=0, ge=0)


class HealthResponse(BaseModel):
    status: str
    version: str
    hf_api_configured: bool
    local_model_loaded: bool
    uptime_s: float


class MetricsResponse(BaseModel):
    axis_classifier: dict
    severity_regressor: dict
    inference: dict
    dataset: dict


class ErrorResponse(BaseModel):
    detail: str
    code: str
    status_code: int


class DiagnosticsResponse(BaseModel):
    backend_reachable: bool
    auth_working: bool
    inference_available: bool
    hf_api_configured: bool
    local_model_loaded: bool
    latency_ms: float
    errors: list[str]
