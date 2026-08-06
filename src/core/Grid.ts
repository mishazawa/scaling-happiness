import { Vector3 } from "three";

export type Grid = {
  columns: number;
  rows: number;
  cellSize: number;
  center: Vector3;
};
