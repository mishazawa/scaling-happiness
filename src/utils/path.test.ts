import { describe, it, expect } from "vitest";
import { Vector3 } from "three";
import { Path } from "../core/Path";
import { roundCorners, samplePath, samplePathDirection } from "./path";

describe("roundCorners", () => {
  const corner = () => [
    new Vector3(0, 0, 0),
    new Vector3(10, 0, 0),
    new Vector3(10, 0, 10),
  ];

  it("leaves the points untouched when rounding is off", () => {
    const points = corner();

    expect(roundCorners(points, 0, 8)).toBe(points);
    expect(roundCorners(points, 2, 0)).toBe(points);
  });

  it("keeps the first and last points exactly where they were", () => {
    const points = corner();
    const rounded = roundCorners(points, 2, 8);

    expect(rounded[0]).toEqual(points[0]);
    expect(rounded[rounded.length - 1]).toEqual(points[2]);
  });

  it("replaces the interior vertex with an arc that stays short of it", () => {
    const points = corner();
    const rounded = roundCorners(points, 2, 8);

    expect(rounded.length).toBeGreaterThan(points.length);
    for (const point of rounded) {
      expect(point.distanceTo(points[1])).toBeGreaterThan(1e-9);
    }
  });

  it("clamps the radius to half of the shortest neighbouring segment", () => {
    const points = [
      new Vector3(0, 0, 0),
      new Vector3(2, 0, 0),
      new Vector3(2, 0, 10),
    ];
    // Radius 5 would overrun the 2-long first segment; it clamps to 1.
    const rounded = roundCorners(points, 5, 8);

    expect(rounded[1].x).toBeCloseTo(1);
    expect(rounded[1].z).toBeCloseTo(0);
  });
});

describe("samplePathDirection", () => {
  const lPath = () =>
    Path([new Vector3(0, 0, 0), new Vector3(10, 0, 0), new Vector3(10, 0, 10)]);

  it("returns the unit tangent of the segment t lands on", () => {
    const path = lPath();

    expect(samplePathDirection(path, 0).toArray()).toEqual([1, 0, 0]);
    expect(samplePathDirection(path, 0.9).toArray()).toEqual([0, 0, 1]);
  });

  it("has no direction to give for a degenerate path", () => {
    expect(samplePathDirection(Path([]), 0).lengthSq()).toBe(0);
    expect(samplePathDirection(Path([new Vector3()]), 0).lengthSq()).toBe(0);
  });

  it("survives a caller holding a sampled position at the same time", () => {
    // The two share a module-level temporary each; one must not clobber the
    // other, since facingSystem reads a position and a heading together.
    const path = lPath();
    const position = samplePath(path, 0.25);
    const direction = samplePathDirection(path, 0.25);

    expect(position.toArray()).toEqual([5, 0, 0]);
    expect(direction.toArray()).toEqual([1, 0, 0]);
  });
});
