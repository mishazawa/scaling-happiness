import { describe, it, expect } from "vitest";
import { Vector3 } from "three";
import { createWorld } from "../core/World";
import { toFlat, toRowColumn } from "../utils/gridMath";
import { makeGrid } from "./grid";
import type { PaletteName } from "../core/Model";
import { FLAG_DARK, FLAG_LIGHT, GRID_CLUSTER } from "../constants";

/**
 * The two palettes the checkerboard alternates between. Distinct from each
 * other, and unrelated to the flags, so nothing here can pass by conflating the
 * two halves of a block's identity.
 */
const PALETTE: [PaletteName, PaletteName] = ["koi", "tide"];

describe("makeGrid", () => {
  it("spawns rows * columns blocks", () => {
    const world = createWorld();
    makeGrid(world, {
      columns: 3,
      rows: 2,
      cellSize: 1,
      center: new Vector3(0, 0, 0),
      palette: PALETTE,
    });

    expect(world.blocks.size).toBe(6);
    expect(world.gridToEntity.size).toBe(6);
  });

  it("addresses every cell by grid index via world.gridToEntity", () => {
    const world = createWorld();
    const columns = 4;
    const rows = 3;

    makeGrid(world, {
      columns,
      rows,
      cellSize: 1,
      center: new Vector3(0, 0, 0),
      palette: PALETTE,
    });

    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const entity = world.gridToEntity.get(toFlat(row, column, columns));
        expect(entity).toBeDefined();

        const block = world.blocks.get(entity!);
        expect(block).toEqual({ row, column });

        const [decodedRow, decodedColumn] = toRowColumn(
          toFlat(row, column, columns),
          columns,
        );
        expect(decodedRow).toBe(row);
        expect(decodedColumn).toBe(column);
      }
    }
  });

  it("centers the grid around config.center", () => {
    const world = createWorld();
    const center = new Vector3(10, 5, -2);
    const cellSize = 2;

    makeGrid(world, {
      columns: 3,
      rows: 3,
      cellSize,
      center,
      palette: PALETTE,
    });

    const middleEntity = world.gridToEntity.get(toFlat(1, 1, 3));
    const middlePosition = world.positions.get(middleEntity!)!;

    expect(middlePosition.x).toBeCloseTo(center.x);
    expect(middlePosition.y).toBeCloseTo(center.y);
    expect(middlePosition.z).toBeCloseTo(center.z);
  });

  it("spaces adjacent cells apart by cellSize", () => {
    const world = createWorld();
    const cellSize = 3;

    makeGrid(world, {
      columns: 2,
      rows: 2,
      cellSize,
      center: new Vector3(0, 0, 0),
      palette: PALETTE,
    });

    const a = world.positions.get(world.gridToEntity.get(toFlat(0, 0, 2))!)!;
    const b = world.positions.get(world.gridToEntity.get(toFlat(0, 1, 2))!)!;
    const c = world.positions.get(world.gridToEntity.get(toFlat(1, 0, 2))!)!;

    expect(b.x - a.x).toBeCloseTo(cellSize);
    expect(c.z - a.z).toBeCloseTo(cellSize);
  });

  it("registers every block as an instance rather than its own Object3D", () => {
    const world = createWorld();

    makeGrid(world, {
      columns: 2,
      rows: 2,
      cellSize: 1,
      center: new Vector3(0, 0, 0),
      palette: PALETTE,
    });

    expect(world.models.size).toBe(4);
    expect(world.renderables.size).toBe(0);
  });

  it("draws with the palettes the config supplies, not a built-in pair", () => {
    const world = createWorld();
    const columns = GRID_CLUSTER * 2;
    const palette: [PaletteName, PaletteName] = ["mermaid", "poster"];

    makeGrid(world, {
      columns,
      rows: 1,
      cellSize: 1,
      center: new Vector3(0, 0, 0),
      palette,
    });

    // Column 0 and column GRID_CLUSTER fall in adjacent clusters, so they land
    // on opposite squares of the checkerboard.
    const first = world.gridToEntity.get(toFlat(0, 0, columns))!;
    const next = world.gridToEntity.get(toFlat(0, GRID_CLUSTER, columns))!;

    expect(world.models.get(first)?.palette).toBe(palette[0]);
    expect(world.models.get(next)?.palette).toBe(palette[1]);
  });

  it("alternates the matching flag alongside the palette", () => {
    const world = createWorld();
    const columns = GRID_CLUSTER * 2;

    makeGrid(world, {
      columns,
      rows: 1,
      cellSize: 1,
      center: new Vector3(0, 0, 0),
      palette: PALETTE,
    });

    const first = world.gridToEntity.get(toFlat(0, 0, columns))!;
    const next = world.gridToEntity.get(toFlat(0, GRID_CLUSTER, columns))!;

    expect(world.flags.get(first)).toBe(FLAG_LIGHT);
    expect(world.flags.get(next)).toBe(FLAG_DARK);
  });
});
