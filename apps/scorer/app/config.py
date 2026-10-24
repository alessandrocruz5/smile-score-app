"""Scorer configuration: environment settings and the smile-score formula constants."""

import os

SCORER_API_KEY = os.environ.get("SCORER_API_KEY", "")
MODEL_PATH = os.environ.get("MODEL_PATH", "models/face_landmarker.task")
MAX_IMAGE_BYTES = int(os.environ.get("MAX_IMAGE_BYTES", "5000000"))

# Scoring formula constants. The Phase 3 calibration tunes these; any change
# must bump FORMULA_VERSION.
W_MOUTH = 0.75
W_EYES = 0.15
W_OPEN = 0.10
MOUTH_GATE = 0.30
FLOOR = 0.05
CEIL = 0.85
FORMULA_VERSION = "formula_v1"
MODEL_VERSION = f"face_landmarker_f16_v1+{FORMULA_VERSION}"
