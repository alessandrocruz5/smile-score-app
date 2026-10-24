"""Score labelled calibration photos and report how well the formula matches the labels.

Filenames start with a 3-digit human label (0-100), e.g. `050_slight.jpg`.

Run from apps/scorer:
    python scripts/calibrate.py [dir] [--model models/face_landmarker.task]
"""

import argparse
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import numpy as np  # noqa: E402
from PIL import Image, ImageOps  # noqa: E402

from app import config  # noqa: E402
from app.landmarker import Landmarker  # noqa: E402
from app.scoring import smile_score  # noqa: E402

LABEL_RE = re.compile(r"^(\d{3})")


def load_rgb(path: Path) -> np.ndarray:
    # Same load path as the /score endpoint.
    img = ImageOps.exif_transpose(Image.open(path)).convert("RGB")
    return np.asarray(img)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument(
        "dir",
        nargs="?",
        default="tests/fixtures/calibration",
        help="directory of labelled *.jpg photos",
    )
    parser.add_argument(
        "--model",
        default=config.MODEL_PATH,
        help="path to face_landmarker.task",
    )
    args = parser.parse_args()

    images = sorted(Path(args.dir).glob("*.jpg"))
    if not images:
        print(f"no images in {args.dir}")
        return 0

    model = Path(args.model)
    if not model.is_file():
        print(f"model not found: {model}", file=sys.stderr)
        return 1

    landmarker = Landmarker(str(model))
    rows: list[tuple[str, int, int]] = []
    try:
        for path in images:
            match = LABEL_RE.match(path.name)
            if match is None:
                print(f"skip {path.name}: no 3-digit label prefix")
                continue
            label = int(match.group(1))

            result = landmarker.detect(load_rgb(path))
            n = len(result.face_landmarks)
            if n == 0:
                print(f"skip {path.name}: no face")
                continue
            if n >= 2:
                print(f"skip {path.name}: {n} faces")
                continue

            blendshapes = {c.category_name: round(c.score, 4) for c in result.face_blendshapes[0]}
            predicted, _ = smile_score(blendshapes)
            rows.append((path.name, label, predicted))
    finally:
        landmarker.close()

    if not rows:
        print("no usable images")
        print(config.MODEL_VERSION)
        return 0

    print(f"{'file':<40} {'label':>5} {'predicted':>9} {'diff':>5}")
    for name, label, predicted in rows:
        print(f"{name:<40} {label:>5} {predicted:>9} {predicted - label:>+5}")

    mae = sum(abs(pred - lbl) for _, lbl, pred in rows) / len(rows)
    print(f"MAE: {mae:.2f}")

    total = 0
    misordered = 0
    for i, (_, label_i, pred_i) in enumerate(rows):
        for _, label_j, pred_j in rows[i + 1 :]:
            if label_i == label_j:
                continue
            total += 1
            # Mis-ordered: the lower-labelled photo scores higher.
            if (label_i < label_j and pred_i > pred_j) or (label_j < label_i and pred_j > pred_i):
                misordered += 1
    print(f"Mis-ordered pairs: {misordered} / {total}")
    print(config.MODEL_VERSION)
    return 0


if __name__ == "__main__":
    sys.exit(main())
