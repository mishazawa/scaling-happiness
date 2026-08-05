import type { Scene, Vector3 } from "three";
import type { World } from "../core/World";

export type Grid = {
  columns: number;
  rows: number;
  cellSize: number;
  center: Vector3;
};

export function makeGrid(_world: World, _scene: Scene, _config: Grid) {}
