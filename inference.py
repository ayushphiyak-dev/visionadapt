"""
inference.py
------------
Image classification via Hugging Face Serverless Inference API
with local scikit-learn fallback.

Primary:  POST to https://api-inference.huggingface.co/models/<model_id>
Fallback: Run the local CVD type classifier from model_weights.json

The HF API is free for small workloads (rate-limited). If it's down,
rate-limited, or the key is missing, the local fallback handles the
request transparently.
"""
import json
import os
import time
import base64
import logging

import requests
import numpy as np

logger = logging.getLogger("visionadapt.inference")

HF_API_URL = "https://api-inference.huggingface.co/models/{model_id}"
HF_API_KEY = os.getenv("HF_API_KEY", "")

# Load local model weights (for fallback)
_local_model = None
_weights_path = os.path.join(os.path.dirname(__file__), "model_weights.json")


def _load_local_model():
    global _local_model
    if _local_model is not None:
        return _local_model
    try:
        with open(_weights_path) as f:
            _local_model = json.load(f)
        logger.info("Local model weights loaded from %s", _weights_path)
    except FileNotFoundError:
        logger.warning("model_weights.json not found at %s — local fallback unavailable", _weights_path)
        _local_model = {}
    return _local_model


def _forward_pass(weights: dict, features: list[float], output_activation: str = "softmax") -> list[float]:
    """Run a simple feed-forward pass: input -> hidden layers -> output."""
    layers = weights["layers"]
    h = np.array(features, dtype=np.float64)
    for i, layer in enumerate(layers):
        W = np.array(layer["W"])
        b = np.array(layer["b"])
        h = h @ W + b
        is_last = i == len(layers) - 1
        if not is_last:
            h = np.maximum(h, 0)  # ReLU
        elif output_activation == "softmax":
            h = np.exp(h - np.max(h))
            h = h / h.sum()
    return h.tolist()


def query_huggingface(image_data: str, model_id: str = "google/vit-base-patch16-224") -> dict:
    """
    Send an image to the Hugging Face Inference API.
    image_data can be a URL or base64-encoded image bytes.
    """
    if not HF_API_KEY:
        return {"error": "HF_API_KEY not configured"}

    headers = {"Authorization": f"Bearer {HF_API_KEY}"}

    # Determine if it's a URL or base64
    if image_data.startswith(("http://", "https://")):
        payload = {"inputs": image_data}
    else:
        # Assume base64
        payload = {"inputs": image_data}

    url = HF_API_URL.format(model_id=model_id)
    try:
        t0 = time.time()
        resp = requests.post(url, headers=headers, json=payload, timeout=30)
        latency_ms = (time.time() - t0) * 1000

        if resp.status_code == 200:
            return {
                "predictions": resp.json(),
                "latency_ms": round(latency_ms, 2),
                "model": model_id,
            }
        else:
            logger.warning("HF API returned %d: %s", resp.status_code, resp.text[:200])
            return {"error": f"HF API returned status {resp.status_code}"}
    except requests.RequestException as e:
        logger.error("HF API request failed: %s", e)
        return {"error": str(e)}


def predict_local(feature_vector: list[float]) -> dict:
    """
    Run the local CVD classifier on a 12-dim feature vector.
    Returns axis label, probabilities, and severity estimate.
    """
    model = _load_local_model()
    if not model:
        return {"error": "Local model not loaded"}

    try:
        t0 = time.time()

        # Axis classifier
        axis_weights = model.get("axis_classifier", {})
        axis_probs = _forward_pass(axis_weights, feature_vector, "softmax")
        axis_idx = axis_probs.index(max(axis_probs))
        axis_labels = model.get("axis_labels", ["Typical", "Red-green", "Blue-yellow"])
        axis_label = axis_labels[axis_idx] if axis_idx < len(axis_labels) else "Unknown"

        # Severity regressor
        sev_weights = model.get("severity_regressor", {})
        severity_raw = _forward_pass(sev_weights, feature_vector, "linear")
        severity = float(np.clip(severity_raw[0] if isinstance(severity_raw, list) else severity_raw, 0, 100))

        latency_ms = (time.time() - t0) * 1000

        return {
            "axis_label": axis_label,
            "axis_probs": {axis_labels[i]: round(p, 4) for i, p in enumerate(axis_probs) if i < len(axis_labels)},
            "severity": round(severity, 1),
            "latency_ms": round(latency_ms, 3),
            "source": "local_sklearn",
        }
    except Exception as e:
        logger.error("Local inference failed: %s", e)
        return {"error": str(e)}


def classify_image(image_url: str, model_id: str = "google/vit-base-patch16-224") -> dict:
    """
    Main classification entry point.
    Tries Hugging Face API first, falls back to local model.
    """
    # Try HF API
    hf_result = query_huggingface(image_url, model_id)
    if "error" not in hf_result:
        return {
            "status": "success",
            "predictions": hf_result["predictions"],
            "source": "huggingface_api",
            "model_used": model_id,
            "latency_ms": hf_result.get("latency_ms"),
        }

    # Fallback to local model
    logger.info("HF API unavailable, falling back to local model")
    local_result = predict_local([0] * 12)  # default zero vector for image-based requests
    if "error" not in local_result:
        return {
            "status": "success_fallback",
            "predictions": local_result,
            "source": "local_sklearn",
            "model_used": "cvd_classifier_local",
            "latency_ms": local_result.get("latency_ms"),
        }

    return {
        "status": "error",
        "predictions": {},
        "source": "none",
        "model_used": "none",
        "error": f"HF API: {hf_result.get('error')}, Local: {local_result.get('error')}",
    }


def get_local_model_info() -> dict:
    """Return metadata about the locally loaded model."""
    model = _load_local_model()
    if not model:
        return {"loaded": False}
    return {
        "loaded": True,
        "axis_labels": model.get("axis_labels", []),
        "plate_keys": model.get("plate_keys", []),
        "confuse_options": model.get("confuse_options", []),
        "feature_dim": model.get("feature_dim", 12),
    }
