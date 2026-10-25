import { describe, expect, it } from "vitest";
import { fitWithin } from "@/lib/downscale";

describe("fitWithin", () => {
  it("scales a landscape image down to 1600 wide", () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1600, height: 1200 });
  });

  it("scales a portrait image down to 1600 tall", () => {
    expect(fitWithin(3000, 4000)).toEqual({ width: 1200, height: 1600 });
  });

  it("never enlarges a small image", () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it("rounds to whole pixels and keeps at least 1px", () => {
    expect(fitWithin(1601, 1)).toEqual({ width: 1600, height: 1 });
  });
});
