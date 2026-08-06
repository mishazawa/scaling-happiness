import type { Scene } from "three";
import type { World } from "../core/World";
import { spawnBlock } from "./block";
import type { Grid } from "../core/Grid";
import { GRID_CLUSTER } from "../constants";
import { cellToWorld } from "../utils/gridMath";

export function makeGrid(world: World, scene: Scene, config: Grid) {
  const { columns, rows } = config;

  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const checkerRow = Math.floor(row / GRID_CLUSTER);
      const checkerColumn = Math.floor(column / GRID_CLUSTER);
      const color = (checkerRow + checkerColumn) % 2 === 0 ? "#FFF" : "#000";

      const position = cellToWorld(config, row, column);

      spawnBlock(world, scene, color, row, column, columns, position);
    }
  }
}
