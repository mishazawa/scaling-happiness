import { Vector3 } from "three";
import type { Grid } from "../core/Grid";
import { HEIGHT_OFFSET } from "../constants";

export const toFlat = (
  row: number,
  column: number,
  columnCount: number,
): number => row * columnCount + column;

export const toRowColumn = (
  flat: number,
  columnCount: number,
): [row: number, column: number] => [
  Math.floor(flat / columnCount),
  flat % columnCount,
];

/**
 * World coordinate of cell (0, 0). Two scalar functions rather than one
 * `{x, z}` return: shootingSystem calls these once per path follower per
 * frame, and an object return would allocate on every call.
 */
export const gridOriginX = (grid: Grid): number =>
  grid.center.x - ((grid.columns - 1) * grid.cellSize) / 2;

export const gridOriginZ = (grid: Grid): number =>
  grid.center.z - ((grid.rows - 1) * grid.cellSize) / 2;

/** Centre of cell (`row`, `column`). Returns a fresh Vector3 — callers keep it. */
export function cellToWorld(grid: Grid, row: number, column: number): Vector3 {
  return new Vector3(
    gridOriginX(grid) + column * grid.cellSize,
    grid.center.y + HEIGHT_OFFSET,
    gridOriginZ(grid) + row * grid.cellSize,
  );
}

/**
 * Inverse of `cellToWorld` along one axis: which lane a world coordinate faces,
 * clamped to the grid. `"x"` yields a column, `"z"` a row.
 */
export function worldToLane(
  grid: Grid,
  coord: number,
  axis: "x" | "z",
): number {
  const origin = axis === "x" ? gridOriginX(grid) : gridOriginZ(grid);
  const count = axis === "x" ? grid.columns : grid.rows;

  const raw = Math.round((coord - origin) / grid.cellSize);
  return Math.min(count - 1, Math.max(0, raw));
}
