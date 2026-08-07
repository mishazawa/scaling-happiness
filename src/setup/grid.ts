import type { World } from "../core/World";
import { spawnBlock } from "./block";
import type { Grid } from "../core/Grid";
import { FLAG_DARK, FLAG_LIGHT, GRID_CLUSTER } from "../constants";
import { cellToWorld } from "../utils/gridMath";

export function makeGrid(world: World, config: Grid) {
  const { columns, rows } = config;

  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const checkerRow = Math.floor(row / GRID_CLUSTER);
      const checkerColumn = Math.floor(column / GRID_CLUSTER);
      // Flag and palette are chosen together here, spelled out rather than
      // looked up: the checkerboard decides both at once.
      const light = (checkerRow + checkerColumn) % 2 === 0;

      spawnBlock(world, {
        flag: light ? FLAG_LIGHT : FLAG_DARK,
        // flag: FLAG_LIGHT, // debug
        palette: light ? config.palette[0] : config.palette[1],
        row,
        column,
        totalColumns: columns,
        position: cellToWorld(config, row, column),
      });
    }
  }
}
