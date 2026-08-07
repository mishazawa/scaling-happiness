import { describe, it, expect } from "vitest";
import { Vector3 } from "three";
import {
  PositionTween,
  ScalarTween,
  samplePositionTween,
  sampleScalarTween,
} from "./Tween";

describe("PositionTween / samplePositionTween", () => {
  it("samples the start point at elapsed 0", () => {
    const tween = PositionTween(
      new Vector3(0, 0, 0),
      new Vector3(10, 0, 0),
      2,
      "linear",
    );

    expect(samplePositionTween(tween)).toEqual(new Vector3(0, 0, 0));
  });

  it("clones the from/to vectors, decoupling them from the caller's originals", () => {
    const from = new Vector3(0, 0, 0);
    const to = new Vector3(10, 0, 0);
    const tween = PositionTween(from, to, 2, "linear");

    from.set(99, 99, 99);
    to.set(-99, -99, -99);

    expect(tween.from).toEqual(new Vector3(0, 0, 0));
    expect(tween.to).toEqual(new Vector3(10, 0, 0));
  });

  it("samples exactly the end point once elapsed reaches duration, without overshoot", () => {
    const tween = PositionTween(
      new Vector3(0, 0, 0),
      new Vector3(10, 0, 0),
      2,
      "linear",
    );
    tween.elapsed = 5;

    expect(samplePositionTween(tween)).toEqual(new Vector3(10, 0, 0));
  });

  it("jumps straight to the end point when duration is 0", () => {
    const tween = PositionTween(
      new Vector3(0, 0, 0),
      new Vector3(10, 0, 0),
      0,
      "linear",
    );

    expect(samplePositionTween(tween)).toEqual(new Vector3(10, 0, 0));
  });

  it("interpolates linearly partway through", () => {
    const tween = PositionTween(
      new Vector3(0, 0, 0),
      new Vector3(10, 0, 0),
      2,
      "linear",
    );
    tween.elapsed = 1;

    expect(samplePositionTween(tween)).toEqual(new Vector3(5, 0, 0));
  });

  it("bends the path through time, not through space — an eased tween still runs straight", () => {
    const tween = PositionTween(
      new Vector3(0, 0, 0),
      new Vector3(10, 0, 0),
      2,
      "easeOutQuad",
    );
    tween.elapsed = 1;

    // easeOutQuad(0.5) = 0.75: three quarters of the way along at half time,
    // and still exactly on the line between the endpoints.
    expect(samplePositionTween(tween)).toEqual(new Vector3(7.5, 0, 0));
  });
});

describe("ScalarTween / sampleScalarTween", () => {
  it("samples the start value at elapsed 0", () => {
    expect(sampleScalarTween(ScalarTween(1, 0, 2, "linear"))).toBe(1);
  });

  it("interpolates linearly partway through", () => {
    const tween = ScalarTween(1, 0, 2, "linear");
    tween.elapsed = 1;

    expect(sampleScalarTween(tween)).toBeCloseTo(0.5);
  });

  it("samples exactly the end value once elapsed reaches duration, without overshoot", () => {
    const tween = ScalarTween(1, 0, 2, "linear");
    tween.elapsed = 5;

    expect(sampleScalarTween(tween)).toBe(0);
  });

  it("jumps straight to the end value when duration is 0", () => {
    expect(sampleScalarTween(ScalarTween(1, 0, 0, "linear"))).toBe(0);
  });

  it("counts upward as happily as down — a spin sweeps past its start", () => {
    const tween = ScalarTween(0.5, 0.5 + Math.PI * 2, 1, "linear");
    tween.elapsed = 0.5;

    expect(sampleScalarTween(tween)).toBeCloseTo(0.5 + Math.PI);
  });
});

/**
 * The easing curve reshapes *when* a tween is where, and nothing else. These pin
 * the two properties every system downstream leans on: the endpoints are still
 * exact whatever the curve, and the shape in between is the named curve's.
 */
describe("easing", () => {
  it("front-loads an ease-out and back-loads an ease-in", () => {
    const out = ScalarTween(0, 1, 2, "easeOutQuad");
    const back = ScalarTween(0, 1, 2, "easeInQuad");
    out.elapsed = 1;
    back.elapsed = 1;

    // easeOutQuad(0.5) = 0.75, easeInQuad(0.5) = 0.25.
    expect(sampleScalarTween(out)).toBeCloseTo(0.75);
    expect(sampleScalarTween(back)).toBeCloseTo(0.25);
  });

  it("still starts on `from` and lands on `to`, whatever the curve", () => {
    // Landing on the end value is what lets a system read a finished tween's
    // sample as the final one instead of snapping the component itself.
    const curves = [
      "easeInQuad",
      "easeOutQuad",
      "easeInOutQuad",
      "easeInCubic",
      "easeOutCubic",
      "easeInOutCubic",
      "easeInSine",
      "easeOutSine",
      "easeInOutSine",
    ] as const;

    for (const easing of curves) {
      const tween = ScalarTween(3, 7, 2, easing);

      expect(sampleScalarTween(tween)).toBeCloseTo(3, 10);

      tween.elapsed = 2;
      expect(sampleScalarTween(tween)).toBeCloseTo(7, 10);
    }
  });
});
