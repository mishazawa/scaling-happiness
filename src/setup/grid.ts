import { Vector3, type Scene } from "three";
import type { World } from "../core/World";
import { spawnBlock } from "./block";

export type Grid = {
  columns: number;
  rows: number;
  cellSize: number;
  center: Vector3;
};
