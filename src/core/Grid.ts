import { Vector3 } from "three";
import type { PaletteName } from "./Model";

export type Grid = {
  columns: number;
  rows: number;
  cellSize: number;
  center: Vector3;
  palette: [PaletteName, PaletteName];
};
