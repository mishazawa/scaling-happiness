import { Vector3, type Scene } from "three";
import type { World } from "../core/World";
import { spawnBlock } from "./block";

export type Grid = {
  columns: number;
  rows: number;
  cellSize: number;
  center: Vector3;
};

export function makeGrid(world: World, scene: Scene, config: Grid) {
  const { columns, rows, cellSize, center } = config;

  const originX = center.x - ((columns - 1) * cellSize) / 2;
  const originZ = center.z - ((rows - 1) * cellSize) / 2;

  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const color = (row + column) % 2 === 0 ? "#FFF" : "#000";
      const position = new Vector3(
        originX + column * cellSize,
        center.y,
        originZ + row * cellSize,
      );

      spawnBlock(world, scene, color, row, column, columns, position);
    }
  }
}
