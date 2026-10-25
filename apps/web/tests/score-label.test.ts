import { describe, expect, it } from "vitest";
import { scoreLabel } from "@/lib/score-label";

describe("scoreLabel", () => {
  it.each([
    [0, "Neutral"],
    [19, "Neutral"],
    [20, "Slight smile"],
    [44, "Slight smile"],
    [45, "Smile"],
    [74, "Smile"],
    [75, "Big smile"],
    [100, "Big smile"],
  ] as const)("labels %i as %s", (score, label) => {
    expect(scoreLabel(score)).toBe(label);
  });
});
