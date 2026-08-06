import { describe, expect, it } from "vitest";
import {
  Rotation,
  axisYawFromDirection,
  normalizeAngle,
  shortestAngleDelta,
  stepAngle,
  yawFromDirection,
} from "./Rotation";

describe("yawFromDirection", () => {
  it("measures headings from +Z, turning toward +X", () => {
    expect(yawFromDirection(0, 1)).toBeCloseTo(0, 6);
    expect(yawFromDirection(1, 0)).toBeCloseTo(Math.PI / 2, 6);
    expect(yawFromDirection(-1, 0)).toBeCloseTo(-Math.PI / 2, 6);
    expect(yawFromDirection(0, -1)).toBeCloseTo(Math.PI, 6);
  });

  it("keeps the fallback when there is no direction to speak of", () => {
    expect(yawFromDirection(0, 0, 1.23)).toBe(1.23);
  });
});

describe("axisYawFromDirection", () => {
  it("snaps to the dominant axis instead of the exact direction", () => {
    // Mostly +X with a little +Z: squares up to +X, no fine tuning.
    expect(axisYawFromDirection(5, 0.4)).toBeCloseTo(Math.PI / 2, 6);
    expect(axisYawFromDirection(0.4, -5)).toBeCloseTo(Math.PI, 6);
    expect(axisYawFromDirection(-5, 0.4)).toBeCloseTo(-Math.PI / 2, 6);
    expect(axisYawFromDirection(-0.4, 5)).toBeCloseTo(0, 6);
  });

  it("only ever yields the four cardinals", () => {
    for (let angle = -Math.PI; angle < Math.PI; angle += 0.05) {
      const yaw = axisYawFromDirection(Math.sin(angle), Math.cos(angle));
      const quarters = yaw / (Math.PI / 2);
      expect(quarters).toBeCloseTo(Math.round(quarters), 6);
    }
  });

  it("keeps the fallback when there is no direction to speak of", () => {
    expect(axisYawFromDirection(0, 0, 1.23)).toBe(1.23);
  });
});

describe("normalizeAngle", () => {
  it("wraps into (-π, π]", () => {
    expect(normalizeAngle(Math.PI * 3)).toBeCloseTo(Math.PI, 6);
    expect(normalizeAngle(-Math.PI * 3)).toBeCloseTo(Math.PI, 6);
    expect(normalizeAngle(0.5)).toBeCloseTo(0.5, 6);
  });
});

describe("shortestAngleDelta", () => {
  it("crosses the ±π seam the short way", () => {
    // Just short of +π to just past -π is a small step, not most of a circle.
    const delta = shortestAngleDelta(Math.PI - 0.1, -Math.PI + 0.1);
    expect(delta).toBeCloseTo(0.2, 6);
  });
});

describe("stepAngle", () => {
  it("moves at most maxDelta toward the target", () => {
    expect(stepAngle(0, 1, 0.25)).toBeCloseTo(0.25, 6);
    expect(stepAngle(0, -1, 0.25)).toBeCloseTo(-0.25, 6);
  });

  it("lands exactly on the target once within reach", () => {
    expect(stepAngle(0.9, 1, 0.25)).toBeCloseTo(1, 6);
  });

  it("takes the short way over the seam rather than unwinding", () => {
    const stepped = stepAngle(Math.PI - 0.1, -Math.PI + 0.1, 0.05);
    expect(stepped).toBeCloseTo(Math.PI - 0.05, 6);
  });

  it("holds still when it cannot turn", () => {
    expect(stepAngle(1, -1, 0)).toBeCloseTo(1, 6);
  });
});

describe("Rotation", () => {
  it("starts already facing its target, with no turn pending", () => {
    const rotation = Rotation(0.5);

    expect(rotation.yaw).toBe(0.5);
    expect(rotation.target).toBe(0.5);
  });
});
