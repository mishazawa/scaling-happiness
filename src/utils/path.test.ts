import { describe, it, expect } from "vitest";
import { Vector3 } from "three";
import { makePathAroundTheGrid } from "./path";
import { TRACK_END_T, TRACK_START_T } from "../constants";
import type { Grid } from "../setup/grid";

const grid: Grid = { columns: 10, rows: 6, cellSize: 1, center: new Vector3() };
const padding = 1;

describe("makePathAroundTheGrid", () => {
  it("produces an open path: no closing segment back to the first point", () => {
    const path = makePathAroundTheGrid(grid, padding);

    expect(path.segLengths.length).toBe(path.points.length - 1);
  });

  it("covers exactly the TRACK_START_T..TRACK_END_T fraction of the grid's full perimeter", () => {
    const halfWidth = (grid.columns * grid.cellSize) / 2 + padding;
    const halfDepth = (grid.rows * grid.cellSize) / 2 + padding;
    const fullPerimeter = 4 * (halfWidth + halfDepth);

    const path = makePathAroundTheGrid(grid, padding);

    expect(path.total).toBeCloseTo((TRACK_END_T - TRACK_START_T) * fullPerimeter);
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
});
