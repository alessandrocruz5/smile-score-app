from types import SimpleNamespace

from mediapipe.tasks.python.vision import FaceLandmarksConnections as C

from app.overlay import build_overlay

PARTS = {
    "lips": C.FACE_LANDMARKS_LIPS,
    "left_eye": C.FACE_LANDMARKS_LEFT_EYE,
    "right_eye": C.FACE_LANDMARKS_RIGHT_EYE,
    "face_oval": C.FACE_LANDMARKS_FACE_OVAL,
}


def fake_landmarks():
    points = [SimpleNamespace(x=0.2 + 0.0006 * i, y=0.3 + 0.0005 * i) for i in range(478)]
    points[0] = SimpleNamespace(x=-0.5, y=0.123456)  # out of range low
    points[1] = SimpleNamespace(x=1.7, y=2.0)  # out of range high
    return points


def test_keys_and_segment_arity():
    overlay = build_overlay(fake_landmarks())
    assert set(overlay) == {"bbox", "lips", "left_eye", "right_eye", "face_oval"}
    assert len(overlay["bbox"]) == 4
    for name in PARTS:
        assert all(len(seg) == 4 for seg in overlay[name])


def test_segment_counts_match_connections():
    overlay = build_overlay(fake_landmarks())
    for name, connections in PARTS.items():
        assert len(overlay[name]) == len(connections)


def test_coordinates_clamped_and_rounded():
    overlay = build_overlay(fake_landmarks())
    for name in PARTS:
        for seg in overlay[name]:
            for v in seg:
                assert 0.0 <= v <= 1.0
                assert v == round(v, 4)
    assert all(0.0 <= v <= 1.0 for v in overlay["bbox"])


def test_bbox_math():
    points = [
        SimpleNamespace(x=0.25, y=0.5),
        SimpleNamespace(x=0.75, y=0.125),
        SimpleNamespace(x=0.5, y=0.875),
    ] * 160
    assert build_overlay(points)["bbox"] == [0.25, 0.125, 0.5, 0.75]
    # out-of-range points are clamped before the bbox is computed
    assert build_overlay(fake_landmarks())["bbox"][0:2] == [0.0, 0.1235]
