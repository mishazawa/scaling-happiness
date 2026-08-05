import { describe, it, expect } from "vitest";
import { Vector3 } from "three";
import { PositionTween, samplePositionTween } from "./Tween";

describe("PositionTween / samplePositionTween", () => {
  it("samples the start point at elapsed 0", () => {
    const tween = PositionTween(new Vector3(0, 0, 0), new Vector3(10, 0, 0), 2);

    expect(samplePositionTween(tween)).toEqual(new Vector3(0, 0, 0));
  });

  it("clones the from/to vectors, decoupling them from the caller's originals", () => {
    const from = new Vector3(0, 0, 0);
    const to = new Vector3(10, 0, 0);
    const tween = PositionTween(from, to, 2);

    from.set(99, 99, 99);
    to.set(-99, -99, -99);

    expect(tween.from).toEqual(new Vector3(0, 0, 0));
    expect(tween.to).toEqual(new Vector3(10, 0, 0));
  });

  it("samples exactly the end point once elapsed reaches duration, without overshoot", () => {
    const tween = PositionTween(new Vector3(0, 0, 0), new Vector3(10, 0, 0), 2);
    tween.elapsed = 5;

    expect(samplePositionTween(tween)).toEqual(new Vector3(10, 0, 0));
  });

  it("jumps straight to the end point when duration is 0", () => {
    const tween = PositionTween(new Vector3(0, 0, 0), new Vector3(10, 0, 0), 0);

    expect(samplePositionTween(tween)).toEqual(new Vector3(10, 0, 0));
  });

  it("interpolates linearly partway through", () => {
    const tween = PositionTween(new Vector3(0, 0, 0), new Vector3(10, 0, 0), 2);
    tween.elapsed = 1;

    expect(samplePositionTween(tween)).toEqual(new Vector3(5, 0, 0));
  });
});
