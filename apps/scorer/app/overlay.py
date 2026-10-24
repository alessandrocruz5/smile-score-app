"""Turn one face's landmarks into normalized overlay segments and a bbox."""

from collections.abc import Sequence
from typing import Any

from mediapipe.tasks.python.vision import FaceLandmarksConnections

Segment = tuple[float, float, float, float]  # x1, y1, x2, y2, normalized 0..1

# The connection constants are edge lists, so the overlay is segments, not
# polylines: the frontend draws `M x1 y1 L x2 y2` per segment.
# left_eye / right_eye follow MediaPipe's naming: the subject's left and right.
_PARTS = {
    "lips": FaceLandmarksConnections.FACE_LANDMARKS_LIPS,
    "left_eye": FaceLandmarksConnections.FACE_LANDMARKS_LEFT_EYE,
    "right_eye": FaceLandmarksConnections.FACE_LANDMARKS_RIGHT_EYE,
    "face_oval": FaceLandmarksConnections.FACE_LANDMARKS_FACE_OVAL,
}


def _norm(value: float) -> float:
    return round(min(1.0, max(0.0, value)), 4)


def build_overlay(landmarks: Sequence[Any]) -> dict:
    xs = [_norm(p.x) for p in landmarks]
    ys = [_norm(p.y) for p in landmarks]
    x_min, x_max = min(xs), max(xs)
    y_min, y_max = min(ys), max(ys)
    overlay: dict = {
        "bbox": [x_min, y_min, round(x_max - x_min, 4), round(y_max - y_min, 4)],
    }
    for name, connections in _PARTS.items():
        overlay[name] = [(xs[c.start], ys[c.start], xs[c.end], ys[c.end]) for c in connections]
    return overlay
