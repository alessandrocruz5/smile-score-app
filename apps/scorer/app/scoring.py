"""Smile-score formula v1: pure functions over a blendshape dict."""

from collections.abc import Mapping

from app import config


def clamp(x: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, x))


def _raw_components(blendshapes: Mapping[str, float]) -> dict[str, float]:
    def get(key: str) -> float:
        return float(blendshapes.get(key, 0.0))

    return {
        "mouth_smile": (get("mouthSmileLeft") + get("mouthSmileRight")) / 2,
        "eye_crinkle": (get("cheekSquintLeft") + get("cheekSquintRight")) / 2,
        "mouth_open": get("jawOpen"),
    }


def components(blendshapes: Mapping[str, float]) -> dict[str, float]:
    return {k: round(v, 4) for k, v in _raw_components(blendshapes).items()}


def smile_score(blendshapes: Mapping[str, float]) -> tuple[int, dict[str, float]]:
    c = _raw_components(blendshapes)
    mouth, eyes, open_ = c["mouth_smile"], c["eye_crinkle"], c["mouth_open"]
    gate = clamp(mouth / config.MOUTH_GATE, 0.0, 1.0)
    raw = config.W_MOUTH * mouth + gate * (config.W_EYES * eyes + config.W_OPEN * open_)
    scaled = clamp((raw - config.FLOOR) / (config.CEIL - config.FLOOR), 0.0, 1.0)
    return int(round(100 * scaled)), {k: round(v, 4) for k, v in c.items()}
