import logging
import os
from io import BytesIO
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app import config
from app.main import app
from app.schemas import ScoreResponse

pytestmark = pytest.mark.skipif(
    not os.path.isfile(config.MODEL_PATH), reason="Face Landmarker model file missing"
)

FIXTURES = Path(__file__).parent / "fixtures"
ERROR_KEYS = {"error", "face_count"}


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def headers() -> dict[str, str]:
    return {"X-Scorer-Key": config.SCORER_API_KEY}


def post(client, data: bytes, hdrs: dict[str, str] | None = None):
    return client.post(
        "/score",
        files={"image": ("upload", data, "application/octet-stream")},
        headers=headers() if hdrs is None else hdrs,
    )


def image_bytes(fmt: str, size: tuple[int, int], color=(200, 200, 200)) -> bytes:
    buf = BytesIO()
    Image.new("RGB", size, color).save(buf, format=fmt)
    return buf.getvalue()


def assert_error(response, status: int, code: str) -> None:
    assert response.status_code == status
    body = response.json()
    assert body["error"] == code
    assert set(body) <= ERROR_KEYS


def test_missing_key(client):
    response = post(client, b"x", hdrs={})
    assert_error(response, 401, "unauthorized")
    assert response.json() == {"error": "unauthorized"}


def test_wrong_key(client):
    response = post(client, b"x", hdrs={"X-Scorer-Key": "wrong"})
    assert_error(response, 401, "unauthorized")
    assert response.json() == {"error": "unauthorized"}


def test_empty_server_key_fails_closed(client, monkeypatch):
    monkeypatch.setattr(config, "SCORER_API_KEY", "")
    response = post(client, b"x", hdrs={"X-Scorer-Key": ""})
    assert_error(response, 401, "unauthorized")
    response = post(client, b"x", hdrs={"X-Scorer-Key": "anything"})
    assert_error(response, 401, "unauthorized")


def test_not_an_image(client):
    assert_error(post(client, b"not an image"), 415, "unsupported_image")


def test_gif_rejected_by_format_allowlist(client):
    assert_error(post(client, image_bytes("GIF", (50, 50))), 415, "unsupported_image")


def test_error_does_not_log_input(client, caplog):
    caplog.set_level(logging.DEBUG)
    response = post(client, b"not an image PRIVACY-MARKER-7f3a")
    assert_error(response, 415, "unsupported_image")
    assert "PRIVACY-MARKER-7f3a" not in caplog.text
    assert "PRIVACY-MARKER-7f3a" not in response.text


def test_too_large(client, monkeypatch):
    monkeypatch.setattr(config, "MAX_IMAGE_BYTES", 100)
    assert_error(post(client, b"a" * 101), 413, "too_large")


def test_no_face(client):
    response = post(client, image_bytes("PNG", (400, 400)))
    assert_error(response, 422, "no_face")


@pytest.mark.skipif(
    not all((FIXTURES / f"{n}.jpg").is_file() for n in ("neutral", "small_smile", "big_smile")),
    reason="owner fixtures missing",
)
def test_smile_ordering(client):
    scores = []
    for name in ("neutral", "small_smile", "big_smile"):
        response = post(client, (FIXTURES / f"{name}.jpg").read_bytes())
        assert response.status_code == 200
        body = ScoreResponse.model_validate(response.json())
        assert len(body.blendshapes) == 52
        scores.append(body.smile_score)
    assert scores[0] < scores[1] < scores[2]
