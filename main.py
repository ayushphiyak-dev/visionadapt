"""
main.py
-------
VisionAdapt API — FastAPI backend for image classification,
JWT authentication, and model metrics serving.

Run:
    pip install -r requirements.txt
    uvicorn main:app --reload --port 8000

Docs:
    http://localhost:8000/docs          (Swagger UI)
    http://localhost:8000/redoc         (ReDoc)
"""
import json
import os

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm

from auth import (
    create_access_token,
    get_current_user,
    register_user,
    authenticate_user,
)
from models import (
    RegisterRequest,
    PredictionRequest,
    PredictionResponse,
    HealthResponse,
)
from inference import classify_image, predict_local, get_local_model_info

app = FastAPI(
    title="VisionAdapt API",
    description="Adaptive computer vision platform for color-vision-deficient gamers",
    version="1.0.0",
)

# CORS — restrict in production, allow all for hackathon dev
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

# ---------------------------------------------------------------------------
# Auth endpoints
# ---------------------------------------------------------------------------

@app.post("/api/v1/auth/register", tags=["Auth"])
async def register(req: RegisterRequest):
    """Create a new user account."""
    user = register_user(req.email, req.password, req.display_name)
    token = create_access_token(req.email)
    return {"access_token": token, "token_type": "bearer", "user": user}


@app.post("/api/v1/auth/login", tags=["Auth"])
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """Authenticate and receive a JWT token."""
    user = authenticate_user(form_data.username, form_data.password)
    token = create_access_token(user["email"])
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"email": user["email"], "display_name": user["display_name"]},
    }


@app.get("/api/v1/auth/me", tags=["Auth"])
async def get_me(user: dict = Depends(get_current_user)):
    """Get current authenticated user profile."""
    return {"email": user["email"], "display_name": user["display_name"]}


# ---------------------------------------------------------------------------
# Prediction endpoints
# ---------------------------------------------------------------------------

@app.post("/api/v1/predict", response_model=PredictionResponse, tags=["Inference"])
async def predict(data: PredictionRequest, user: dict = Depends(get_current_user)):
    """
    Classify an image using the Hugging Face Inference API.
    Falls back to the local CVD classifier if the API is unavailable.
    """
    result = classify_image(data.image_url, data.model)
    return PredictionResponse(
        status=result["status"],
        authenticated_user=user["email"],
        predictions=result["predictions"],
        source=result["source"],
        model_used=result["model_used"],
    )


@app.post("/api/v1/predict/cvd", tags=["Inference"])
async def predict_cvd(
    features: list[float],
    user: dict = Depends(get_current_user),
):
    """
    Run the local CVD type & severity classifier on a 12-dim feature vector.
    No external API call — runs entirely on the server.
    """
    if len(features) != 12:
        raise HTTPException(
            status_code=400,
            detail=f"Expected 12-dim feature vector, got {len(features)}",
        )
    result = predict_local(features)
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    return result


# ---------------------------------------------------------------------------
# Model info endpoints
# ---------------------------------------------------------------------------

@app.get("/api/v1/metrics", tags=["Model"])
async def get_metrics():
    """Return held-out test set evaluation metrics for the CVD classifier."""
    metrics_path = os.path.join(os.path.dirname(__file__), "metrics.json")
    try:
        with open(metrics_path) as f:
            return json.load(f)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="metrics.json not found")


@app.get("/api/v1/model/info", tags=["Model"])
async def get_model_info():
    """Return metadata about the locally loaded model."""
    return get_local_model_info()


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/api/v1/health", response_model=HealthResponse, tags=["System"])
async def health():
    """Health check endpoint for monitoring and load balancers."""
    hf_configured = bool(os.getenv("HF_API_KEY"))
    model_info = get_local_model_info()
    return HealthResponse(
        status="healthy",
        version="1.0.0",
        hf_api_configured=hf_configured,
        local_model_loaded=model_info.get("loaded", False),
    )


# ---------------------------------------------------------------------------
# Root
# ---------------------------------------------------------------------------

@app.get("/", tags=["System"])
async def root():
    return {
        "name": "VisionAdapt API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/api/v1/health",
    }
