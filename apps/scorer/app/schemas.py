"""Response models for POST /score. This contract is mirrored by the web zod schema."""

from pydantic import BaseModel, Field

Segment = tuple[float, float, float, float]  # x1, y1, x2, y2, normalized 0..1


class Components(BaseModel):
    mouth_smile: float
    eye_crinkle: float
    mouth_open: float


class Overlay(BaseModel):
    bbox: tuple[float, float, float, float]  # x, y, width, height, normalized 0..1
    lips: list[Segment]
    left_eye: list[Segment]
    right_eye: list[Segment]
    face_oval: list[Segment]


class ScoreResponse(BaseModel):
    face_count: int
    smile_score: int = Field(ge=0, le=100)
    components: Components
    blendshapes: dict[str, float]
    overlay: Overlay
    model_version: str
