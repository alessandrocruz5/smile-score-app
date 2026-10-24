"""MediaPipe Face Landmarker wrapper: the model loads once, detection calls are serialized."""

import threading

import mediapipe as mp
import numpy as np
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision


class Landmarker:
    def __init__(self, model_path: str) -> None:
        options = vision.FaceLandmarkerOptions(
            base_options=mp_python.BaseOptions(model_asset_path=model_path),
            running_mode=vision.RunningMode.IMAGE,
            output_face_blendshapes=True,  # off by default
            num_faces=2,  # the default of 1 would hide multiple faces
        )
        self._landmarker = vision.FaceLandmarker.create_from_options(options)
        # Task instances aren't documented as thread-safe, and FastAPI runs sync
        # endpoints concurrently in its threadpool, so calls are serialized.
        # To scale, add instances (processes), not threads.
        self._lock = threading.Lock()

    def detect(self, rgb: np.ndarray) -> vision.FaceLandmarkerResult:
        image = np.ascontiguousarray(rgb, dtype=np.uint8)
        with self._lock:
            return self._landmarker.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=image))

    def close(self) -> None:
        with self._lock:
            self._landmarker.close()
