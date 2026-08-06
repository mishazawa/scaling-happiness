import type { World } from "../core/World";
import { spawnBlock } from "./block";
import type { Grid } from "../core/Grid";
import {
  BLOCK_COLOR_DARK,
  BLOCK_COLOR_LIGHT,
  GRID_CLUSTER,
} from "../constants";
import { cellToWorld } from "../utils/gridMath";

export function makeGrid(world: World, config: Grid) {
  const { columns, rows } = config;

  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const checkerRow = Math.floor(row / GRID_CLUSTER);
      const checkerColumn = Math.floor(column / GRID_CLUSTER);
      const color =
        (checkerRow + checkerColumn) % 2 === 0
          ? BLOCK_COLOR_LIGHT
          : BLOCK_COLOR_DARK;

      const position = cellToWorld(config, row, column);

      spawnBlock(world, color, row, column, columns, position);
    }
  }
}
