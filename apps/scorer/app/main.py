import hmac
import os
from contextlib import asynccontextmanager
from io import BytesIO
from typing import Annotated

import numpy as np
from fastapi import Depends, FastAPI, File, Header, Request, UploadFile
from fastapi.responses import JSONResponse
from PIL import Image, ImageOps, UnidentifiedImageError

from app import config
from app.landmarker import Landmarker
from app.overlay import build_overlay
from app.schemas import Components, Overlay, ScoreResponse
from app.scoring import smile_score

ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}


class ScorerError(Exception):
    def __init__(self, status: int, code: str, **extra: int) -> None:
        super().__init__(code)
        self.status = status
        self.code = code
        self.extra = extra


def require_key(x_scorer_key: str | None = Header(default=None)) -> None:
    # Read at call time so tests can monkeypatch it. An empty key fails closed.
    expected = config.SCORER_API_KEY
    if not expected or x_scorer_key is None:
        raise ScorerError(401, "unauthorized")
    if not hmac.compare_digest(x_scorer_key.encode(), expected.encode()):
        raise ScorerError(401, "unauthorized")


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not os.path.isfile(config.MODEL_PATH):
        raise RuntimeError(f"Face Landmarker model not found at {config.MODEL_PATH}")
    app.state.landmarker = Landmarker(config.MODEL_PATH)
    try:
        yield
    finally:
        app.state.landmarker.close()


app = FastAPI(title="Smile Scorer", lifespan=lifespan)


@app.exception_handler(ScorerError)
async def scorer_error_handler(request: Request, exc: ScorerError) -> JSONResponse:
    return JSONResponse(status_code=exc.status, content={"error": exc.code, **exc.extra})


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "model_loaded": getattr(app.state, "landmarker", None) is not None,
    }


# Privacy (R14): the image lives in memory only. Never write it to disk, never log
# its bytes (raw or base64) or Pillow's error text about it, and never echo any input
# in an error body: error bodies contain only `error` (plus `face_count`).
# Starlette's multipart parser (1.9.0) spools a part over 1 MB (spool_max_size) to a
# temporary file that it deletes when the request ends. We don't work around that;
# the README states it.
#
# Sync `def`: CPU-bound inference runs in the threadpool instead of blocking the event loop.
@app.post("/score", response_model=ScoreResponse, dependencies=[Depends(require_key)])
def score(request: Request, image: Annotated[UploadFile, File()]) -> ScoreResponse:
    data = image.file.read(config.MAX_IMAGE_BYTES + 1)
    if len(data) > config.MAX_IMAGE_BYTES:
        raise ScorerError(413, "too_large")

    try:
        img = Image.open(BytesIO(data))
        # Read the format before any transform: exif_transpose/convert drop it.
        if img.format not in ALLOWED_FORMATS:
            raise ScorerError(415, "unsupported_image")
        img.load()
        img = ImageOps.exif_transpose(img).convert("RGB")
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
        # `from None`: no chained Pillow error text.
        raise ScorerError(415, "unsupported_image") from None

    result = request.app.state.landmarker.detect(np.asarray(img))

    n = len(result.face_landmarks)
    if n == 0:
        raise ScorerError(422, "no_face")
    if n >= 2:
        raise ScorerError(422, "multiple_faces", face_count=n)

    blendshapes = {c.category_name: round(c.score, 4) for c in result.face_blendshapes[0]}
    value, comps = smile_score(blendshapes)
    return ScoreResponse(
        face_count=1,
        smile_score=value,
        components=Components(**comps),
        blendshapes=blendshapes,
        overlay=Overlay(**build_overlay(result.face_landmarks[0])),
        model_version=config.MODEL_VERSION,
    )
