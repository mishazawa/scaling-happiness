import { describe, it, expect } from "vitest";
import { Vector3 } from "three";
import { roundCorners } from "./path";

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
