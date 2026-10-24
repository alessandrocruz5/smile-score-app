#!/usr/bin/env bash
set -euo pipefail

MODEL_URL="https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
dir="${1:-models}"

mkdir -p "$dir"
if [ -s "$dir/face_landmarker.task" ]; then
  echo "Model already present at $dir/face_landmarker.task"
  exit 0
fi
curl -fsSL -o "$dir/face_landmarker.task" "$MODEL_URL"
