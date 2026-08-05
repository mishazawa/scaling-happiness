import type { Vector3 } from "three";
import type { World } from "../core/World";

export type Grid = {
  columns: number;
  rows: number;
  cellSize: number;
  center: Vector3;
};



export function makeGrid(world: World, scene: Scene, config: Grid) {

  for each row:
   for each column:
      
}
