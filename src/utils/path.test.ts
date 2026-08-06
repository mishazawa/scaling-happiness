import { describe, it, expect } from "vitest";
import { Vector3 } from "three";
import { makePathAroundTheGrid, roundCorners } from "./path";
import { TRACK_END_T, TRACK_START_T } from "../constants";
import type { Grid } from "../setup/grid";

const grid: Grid = { columns: 10, rows: 6, cellSize: 1, center: new Vector3() };
const padding = 1;

describe("makePathAroundTheGrid", () => {
  it("produces an open path: no closing segment back to the first point", () => {
    const path = makePathAroundTheGrid(grid, padding);

    expect(path.segLengths.length).toBe(path.points.length - 1);
  });

  it("covers the TRACK_START_T..TRACK_END_T fraction of the grid's full perimeter, minus what the rounded corners cut", () => {
    const halfWidth = (grid.columns * grid.cellSize) / 2 + padding;
    const halfDepth = (grid.rows * grid.cellSize) / 2 + padding;
    const fullPerimeter = 4 * (halfWidth + halfDepth);
    const sharpTotal = (TRACK_END_T - TRACK_START_T) * fullPerimeter;

    const path = makePathAroundTheGrid(grid, padding);

    // Cutting corners can only shorten the track, and only slightly.
    expect(path.total).toBeLessThanOrEqual(sharpTotal);
    expect(path.total).toBeGreaterThan(sharpTotal * 0.95);
  });

  it("starts and ends inside the grid boundary loop rather than at a corner", () => {
    const path = makePathAroundTheGrid(grid, padding);
    const halfWidth = (grid.columns * grid.cellSize) / 2 + padding;
    const halfDepth = (grid.rows * grid.cellSize) / 2 + padding;

    const corners = [
      new Vector3(-halfWidth, 0, -halfDepth),
      new Vector3(halfWidth, 0, -halfDepth),
      new Vector3(halfWidth, 0, halfDepth),
      new Vector3(-halfWidth, 0, halfDepth),
    ];

    const start = path.points[0];
    const end = path.points[path.points.length - 1];
    for (const corner of corners) {
      expect(start.distanceTo(corner)).toBeGreaterThan(0);
      expect(end.distanceTo(corner)).toBeGreaterThan(0);
    }
  });

  it("never bulges outside the sharp corner it rounds", () => {
    const halfWidth = (grid.columns * grid.cellSize) / 2 + padding;
    const halfDepth = (grid.rows * grid.cellSize) / 2 + padding;

    const path = makePathAroundTheGrid(grid, padding);

    for (const point of path.points) {
      expect(Math.abs(point.x)).toBeLessThanOrEqual(halfWidth + 1e-9);
      expect(Math.abs(point.z)).toBeLessThanOrEqual(halfDepth + 1e-9);
    }
  });
});

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
