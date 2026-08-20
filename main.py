import json
import os
import time
import logging
import asyncio

from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from auth import (
    create_access_token, get_current_user, register_user, authenticate_user,
    get_user_public, save_user_profile, get_user_profile, _ensure_admin,
)
from models import (
    RegisterRequest, LoginRequest, PredictionRequest, PredictionResponse,
    ProfileSaveRequest, ProfileResponse, HealthResponse, DiagnosticsResponse,
    ErrorResponse, CvdPredictRequest,
)
from inference import classify_image, predict_local, get_local_model_info, run_diagnostics

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("visionadapt")

_START_TIME = time.time()

app = FastAPI(
    title="VisionAdapt API",
    description="Adaptive computer vision platform for color-vision-deficient gamers",
    version="1.0.0",
    responses={
        422: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:8000",
        "http://localhost:8080",
        "https://visionadapt.vercel.app",
        "https://*.github.io",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app|https://.*\.onrender\.com",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    _ensure_admin()


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error("Unhandled exception: %s", exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "code": "INTERNAL_ERROR", "status_code": 500},
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "code": "HTTP_ERROR", "status_code": exc.status_code},
    )


@app.post("/api/v1/auth/register", tags=["Auth"], responses={409: {"model": ErrorResponse}})
async def register(req: RegisterRequest):
    user = register_user(req.email, req.password, req.display_name)
    token = create_access_token(req.email)
    return {"access_token": token, "token_type": "bearer", "user": user}


@app.post("/api/v1/auth/login", tags=["Auth"], responses={401: {"model": ErrorResponse}})
async def login(req: LoginRequest):
    user = authenticate_user(req.email, req.password)
    token = create_access_token(user["email"])
    return {"access_token": token, "token_type": "bearer", "user": get_user_public(user)}


@app.post("/api/v1/auth/login/form", tags=["Auth"], responses={401: {"model": ErrorResponse}})
async def login_form(form_data: OAuth2PasswordRequestForm = Depends()):
    user = authenticate_user(form_data.username, form_data.password)
    token = create_access_token(user["email"])
    return {"access_token": token, "token_type": "bearer", "user": get_user_public(user)}


@app.get("/api/v1/auth/me", tags=["Auth"])
async def get_me(user: dict = Depends(get_current_user)):
    return get_user_public(user)


@app.post(
    "/api/v1/predict",
    response_model=PredictionResponse,
    tags=["Inference"],
    responses={401: {"model": ErrorResponse}, 502: {"model": ErrorResponse}},
)
async def predict(data: PredictionRequest, user: dict = Depends(get_current_user)):
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, classify_image, data.image_url, data.model)
    if result["status"] == "error":
        raise HTTPException(status_code=502, detail=f"All inference backends failed: {result.get('error', 'unknown')}")
    return PredictionResponse(
        status=result["status"],
        authenticated_user=user["email"],
        predictions=result["predictions"],
        source=result["source"],
        model_used=result["model_used"],
        latency_ms=result.get("latency_ms"),
    )


@app.post("/api/v1/predict/cvd", tags=["Inference"], responses={400: {"model": ErrorResponse}, 500: {"model": ErrorResponse}})
async def predict_cvd(data: CvdPredictRequest, user: dict = Depends(get_current_user)):
    result = predict_local(data.features)
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    return result


@app.post("/api/v1/profile", tags=["Profile"], responses={401: {"model": ErrorResponse}})
async def save_profile(data: ProfileSaveRequest, user: dict = Depends(get_current_user)):
    profile = save_user_profile(user["email"], data.model_dump())
    return {"status": "saved", "profile": profile}


@app.get("/api/v1/profile", tags=["Profile"], responses={401: {"model": ErrorResponse}})
async def get_profile(user: dict = Depends(get_current_user)):
    profile = get_user_profile(user["email"])
    if not profile:
        return {"status": "not_found", "profile": None}
    return {"status": "ok", "profile": profile}


@app.get("/api/v1/model/info", tags=["Model"])
async def get_model_info():
    return get_local_model_info()


@app.get("/api/v1/diagnostics", response_model=DiagnosticsResponse, tags=["System"])
async def diagnostics():
    return run_diagnostics()


@app.get("/api/v1/health", response_model=HealthResponse, tags=["System"])
async def health():
    model_info = get_local_model_info()
    return HealthResponse(
        status="healthy",
        version="1.0.0",
        hf_api_configured=bool(os.getenv("HF_API_KEY")),
        local_model_loaded=model_info.get("loaded", False),
        uptime_s=round(time.time() - _START_TIME, 1),
    )


@app.get("/", tags=["System"])
async def root():
    return {"name": "VisionAdapt API", "version": "1.0.0", "docs": "/docs", "health": "/api/v1/health"}
