import os

from fastapi.testclient import TestClient

from app import config
from app.main import app


def test_health():
    if os.path.isfile(config.MODEL_PATH):
        with TestClient(app) as client:
            response = client.get("/health")
        assert response.json()["model_loaded"] is True
    else:
        response = TestClient(app).get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
