export type ScoreLabel = "Neutral" | "Slight smile" | "Smile" | "Big smile";

/** Display label for a 0-100 smile score. UI only, never stored. */
export function scoreLabel(score: number): ScoreLabel {
  if (score < 20) return "Neutral";
  if (score < 45) return "Slight smile";
  if (score < 75) return "Smile";
  return "Big smile";
}
