import base64
import json
import os
import time
import logging

import requests
import numpy as np

logger = logging.getLogger("visionadapt.inference")

HF_API_URL = "https://api-inference.huggingface.co/models/{model_id}"
HF_API_KEY = os.getenv("HF_API_KEY", "")

_local_model = None
_weights_path = os.path.join(os.path.dirname(__file__), "model_weights.json")


def _load_local_model():
    global _local_model
    if _local_model is not None:
        return _local_model
    try:
        with open(_weights_path) as f:
            _local_model = json.load(f)
        logger.info("Local model weights loaded")
    except FileNotFoundError:
        logger.warning("model_weights.json not found — local fallback unavailable")
        _local_model = {}
    return _local_model


def _forward_pass(weights: dict, features: list[float], output_activation: str = "softmax") -> list[float]:
    layers = weights.get("layers", [])
    if not layers:
        return []
    h = np.array(features, dtype=np.float64)
    for i, layer in enumerate(layers):
        W = np.array(layer["W"])
        b = np.array(layer["b"])
        h = h @ W + b
        is_last = i == len(layers) - 1
        if not is_last:
            h = np.maximum(h, 0)
        elif output_activation == "softmax":
            h = np.exp(h - np.max(h))
            total = h.sum()
            h = h / total if total > 0 else h * 0
    return h.tolist()


def query_huggingface(image_data: str, model_id: str = "google/vit-base-patch16-224") -> dict:
    if not HF_API_KEY:
        return {"error": "HF_API_KEY not configured. The assessment uses client-side ML — this endpoint is for image classification demos only.", "latency_ms": 0}

    headers = {"Authorization": f"Bearer {HF_API_KEY}"}
    api_url = HF_API_URL.format(model_id=model_id)

    try:
        t0 = time.time()

        image_bytes = None
        if image_data.startswith("data:"):
            _, encoded = image_data.split(",", 1)
            image_bytes = base64.b64decode(encoded)
            headers["Content-Type"] = "application/octet-stream"
        elif image_data.startswith("http://") or image_data.startswith("https://"):
            img_resp = requests.get(image_data, timeout=10)
            if img_resp.status_code != 200:
                return {"error": f"Failed to download image: HTTP {img_resp.status_code}", "latency_ms": 0}
            image_bytes = img_resp.content
            ct = img_resp.headers.get("Content-Type", "image/png")
            headers["Content-Type"] = ct
        else:
            return {
                "error": "Invalid image input. Provide a URL (https://...) or base64 data URI (data:image/...;base64,...).",
                "latency_ms": 0,
            }

        resp = requests.post(api_url, headers=headers, data=image_bytes, timeout=15)
        latency_ms = (time.time() - t0) * 1000

        if resp.status_code == 200:
            return {"predictions": resp.json(), "latency_ms": round(latency_ms, 2), "model": model_id}
        elif resp.status_code == 503:
            return {"error": f"Model {model_id} is loading, try again later", "latency_ms": round(latency_ms, 2)}
        elif resp.status_code == 429:
            return {"error": "Rate limited by HuggingFace API", "latency_ms": round(latency_ms, 2)}
        else:
            logger.warning("HF API returned %d: %s", resp.status_code, resp.text[:200])
            return {"error": f"HF API returned status {resp.status_code}: {resp.text[:120]}", "latency_ms": round(latency_ms, 2)}
    except requests.Timeout:
        return {"error": "HuggingFace API request timed out (15s)", "latency_ms": 15000}
    except requests.ConnectionError:
        return {"error": "Cannot reach HuggingFace API", "latency_ms": 0}
    except requests.RequestException as e:
        logger.error("HF API request failed: %s", e)
        return {"error": f"Request failed: {str(e)[:200]}", "latency_ms": 0}


def predict_local(feature_vector: list[float]) -> dict:
    model = _load_local_model()
    if not model:
        return {"error": "Local model weights not loaded"}

    expected_dim = model.get("feature_dim", 12)
    if len(feature_vector) != expected_dim:
        return {"error": f"Expected {expected_dim}-dim vector, got {len(feature_vector)}"}

    try:
        t0 = time.time()

        axis_weights = model.get("axis_classifier", {})
        if not axis_weights.get("layers"):
            return {"error": "Axis classifier weights missing"}
        axis_probs = _forward_pass(axis_weights, feature_vector, "softmax")
        axis_idx = axis_probs.index(max(axis_probs))
        axis_labels = model.get("axis_labels", ["Typical", "Red-green", "Blue-yellow"])
        axis_label = axis_labels[axis_idx] if axis_idx < len(axis_labels) else "Unknown"

        sev_weights = model.get("severity_regressor", {})
        if not sev_weights.get("layers"):
            return {"error": "Severity regressor weights missing"}
        severity_raw = _forward_pass(sev_weights, feature_vector, "linear")
        severity = float(np.clip(
            severity_raw[0] if isinstance(severity_raw, list) and severity_raw else 0, 0, 100
        ))

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
        return {"error": f"Inference failed: {str(e)[:200]}"}


def classify_image(image_url: str, model_id: str = "google/vit-base-patch16-224") -> dict:
    if not HF_API_KEY:
        return {
            "status": "error",
            "predictions": {},
            "source": "none",
            "model_used": "none",
            "error": "Image classification requires HF_API_KEY. Use the /predict/cvd endpoint for the local assessment model instead.",
        }

    hf_result = query_huggingface(image_url, model_id)
    if "error" not in hf_result:
        return {
            "status": "success",
            "predictions": hf_result["predictions"],
            "source": "huggingface_api",
            "model_used": model_id,
            "latency_ms": hf_result.get("latency_ms"),
        }

    logger.info("HF API unavailable (%s), falling back to local model", hf_result.get("error"))
    return {
        "status": "error",
        "predictions": {},
        "source": "none",
        "model_used": "none",
        "error": f"HF: {hf_result.get('error')}",
    }


def get_local_model_info() -> dict:
    model = _load_local_model()
    if not model:
        return {"loaded": False, "error": "weights file missing"}
    return {
        "loaded": True,
        "axis_labels": model.get("axis_labels", []),
        "plate_keys": model.get("plate_keys", []),
        "confuse_options": model.get("confuse_options", []),
        "feature_dim": model.get("feature_dim", 12),
        "layers": len(model.get("axis_classifier", {}).get("layers", [])),
    }


def run_diagnostics() -> dict:
    errors = []
    t0 = time.time()

    model = _load_local_model()
    model_loaded = bool(model and model.get("axis_classifier", {}).get("layers"))

    hf_configured = bool(HF_API_KEY)

    inference_ok = False
    if model_loaded:
        test_result = predict_local([1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0])
        inference_ok = "error" not in test_result
        if not inference_ok:
            errors.append(f"Local inference test failed: {test_result.get('error')}")

    latency_ms = (time.time() - t0) * 1000

    return {
        "backend_reachable": True,
        "auth_working": True,
        "inference_available": inference_ok or hf_configured,
        "hf_api_configured": hf_configured,
        "local_model_loaded": model_loaded,
        "latency_ms": round(latency_ms, 2),
        "errors": errors,
    }
