import { describe, it, expect } from "vitest";
import { Scene, Vector3 } from "three";
import { createWorld } from "../core/World";
import { toFlat, toRowColumn } from "../utils";
import { makeGrid } from "./grid";

describe("makeGrid", () => {
  it("spawns rows * columns blocks", () => {
    const world = createWorld();
    makeGrid(world, new Map(), new Scene(), {
      columns: 3,
      rows: 2,
      cellSize: 1,
      center: new Vector3(0, 0, 0),
    });

    expect(world.blocks.size).toBe(6);
    expect(world.gridToEntity.size).toBe(6);
  });

  it("addresses every cell by grid index via world.gridToEntity", () => {
    const world = createWorld();
    const columns = 4;
    const rows = 3;

    makeGrid(world, new Map(), new Scene(), {
      columns,
      rows,
      cellSize: 1,
      center: new Vector3(0, 0, 0),
    });

    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const entity = world.gridToEntity.get(toFlat(row, column, columns));
        expect(entity).toBeDefined();

        const block = world.blocks.get(entity!);
        expect(block).toEqual({ color: block!.color, row, column });

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
    const renderables = new Map();
    const center = new Vector3(10, 5, -2);
    const cellSize = 2;

    makeGrid(world, renderables, new Scene(), {
      columns: 3,
      rows: 3,
      cellSize,
      center,
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

    makeGrid(world, new Map(), new Scene(), {
      columns: 2,
      rows: 2,
      cellSize,
      center: new Vector3(0, 0, 0),
    });

    const a = world.positions.get(world.gridToEntity.get(toFlat(0, 0, 2))!)!;
    const b = world.positions.get(world.gridToEntity.get(toFlat(0, 1, 2))!)!;
    const c = world.positions.get(world.gridToEntity.get(toFlat(1, 0, 2))!)!;

    expect(b.x - a.x).toBeCloseTo(cellSize);
    expect(c.z - a.z).toBeCloseTo(cellSize);
  });

  it("registers a renderable mesh in the scene for every block", () => {
    const world = createWorld();
    const renderables = new Map();
    const scene = new Scene();

    makeGrid(world, renderables, scene, {
      columns: 2,
      rows: 2,
      cellSize: 1,
      center: new Vector3(0, 0, 0),
    });

    expect(renderables.size).toBe(4);
    expect(scene.children.length).toBe(4);
  });
});
