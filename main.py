import json
import os
import time
import logging

from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.responses import JSONResponse

from auth import create_access_token, get_current_user, register_user, authenticate_user, get_user_public
from models import (
    RegisterRequest, PredictionRequest, PredictionResponse,
    HealthResponse, DiagnosticsResponse, ErrorResponse,
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
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
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
    result = classify_image(data.image_url, data.model)
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
async def predict_cvd(features: list[float], user: dict = Depends(get_current_user)):
    if len(features) != 12:
        raise HTTPException(status_code=400, detail=f"Expected 12-dim feature vector, got {len(features)}")
    if not all(isinstance(f, (int, float)) for f in features):
        raise HTTPException(status_code=400, detail="All features must be numeric")
    result = predict_local(features)
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    return result


@app.get("/api/v1/metrics", tags=["Model"], responses={404: {"model": ErrorResponse}})
async def get_metrics():
    metrics_path = os.path.join(os.path.dirname(__file__), "metrics.json")
    try:
        with open(metrics_path) as f:
            return json.load(f)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="metrics.json not found — run train.py first")


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
