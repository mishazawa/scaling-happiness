import { describe, it, expect } from "vitest";
import { Scene, Vector3 } from "three";
import { createWorld } from "../core/World";
import { createEntity } from "../core/Entity";
import { Position } from "../core/Position";
import { PathFollower } from "../core/Path";
import { hasTag } from "../core/Tag";
import { spawnBlock } from "../setup/block";
import type { Grid } from "../setup/grid";
import { toFlat } from "../utils";
import { shootingSystem } from "./shooting";

function makeGrid(): Grid {
  return {
    columns: 3,
    rows: 3,
    cellSize: 1,
    center: new Vector3(0, 0, 0),
  };
}

function makePawn(
  world: ReturnType<typeof createWorld>,
  position: Vector3,
  ammo?: number,
) {
  const pawn = createEntity();
  world.positions.set(pawn, Position(position.x, position.y, position.z));
  world.colors.set(pawn, "#FFF");
  const pathEntity = createEntity();
  world.pathFollowers.set(pawn, PathFollower(pathEntity, 1));
  if (ammo !== undefined) world.ammo.set(pawn, ammo);
  return pawn;
}

describe("shootingSystem", () => {
  it("destroys the frontmost block in the lane a pawn on the bottom edge faces", () => {
    const world = createWorld();
    const grid = makeGrid();
    // column 1 (x = 0), rows 0..2 all occupied.
    spawnBlock(world, new Scene(), "#FFF", 0, 1, 3, new Vector3(0, 0, -1));
    spawnBlock(world, new Scene(), "#FFF", 1, 1, 3, new Vector3(0, 0, 0));
    spawnBlock(world, new Scene(), "#FFF", 2, 1, 3, new Vector3(0, 0, 1));

    // Below the grid (smaller z), facing inward toward increasing row.
    makePawn(world, new Vector3(0, 0, -2));

    shootingSystem(world, grid);

    const block = world.gridToEntity.get(toFlat(0, 1, 3))!;
    expect(hasTag(world, block, "destroy")).toBe(true);
    expect(world.events).toEqual([]);
  });

  it("fires from the nearest edge, skipping already-empty cells closer to the track", () => {
    const world = createWorld();
    const grid = makeGrid();
    // Only row 2 (farthest from the bottom edge) is occupied in column 1.
    spawnBlock(world, new Scene(), "#FFF", 2, 1, 3, new Vector3(0, 0, 1));

    makePawn(world, new Vector3(0, 0, -2));

    shootingSystem(world, grid);

    const block = world.gridToEntity.get(toFlat(2, 1, 3))!;
    expect(hasTag(world, block, "destroy")).toBe(true);
  });

  it("fires inward from the top edge, starting at the highest row index", () => {
    const world = createWorld();
    const grid = makeGrid();
    spawnBlock(world, new Scene(), "#FFF", 0, 1, 3, new Vector3(0, 0, -1));
    spawnBlock(world, new Scene(), "#FFF", 2, 1, 3, new Vector3(0, 0, 1));

    makePawn(world, new Vector3(0, 0, 2));

    shootingSystem(world, grid);

    const block = world.gridToEntity.get(toFlat(2, 1, 3))!;
    expect(hasTag(world, block, "destroy")).toBe(true);
  });

  it("fires inward from the left/right edges along the row axis", () => {
    const world = createWorld();
    const grid = makeGrid();
    spawnBlock(world, new Scene(), "#FFF", 1, 0, 3, new Vector3(-1, 0, 0));
    spawnBlock(world, new Scene(), "#FFF", 1, 2, 3, new Vector3(1, 0, 0));

    makePawn(world, new Vector3(-2, 0, 0));

    shootingSystem(world, grid);

    const block = world.gridToEntity.get(toFlat(1, 0, 3))!;
    expect(hasTag(world, block, "destroy")).toBe(true);
  });

  it("does not fire again while the pawn stays in the same lane", () => {
    const world = createWorld();
    const grid = makeGrid();
    spawnBlock(world, new Scene(), "#FFF", 0, 1, 3, new Vector3(0, 0, -1));

    makePawn(world, new Vector3(0, 0, -2));

    shootingSystem(world, grid);
    const block = world.gridToEntity.get(toFlat(0, 1, 3))!;
    world.tags.get(block)?.delete("destroy"); // simulate GC having run

    shootingSystem(world, grid);

    expect(hasTag(world, block, "destroy")).toBe(false);
  });

  it("fires again once the pawn moves to a new lane", () => {
    const world = createWorld();
    const grid = makeGrid();
    spawnBlock(world, new Scene(), "#FFF", 0, 0, 3, new Vector3(-1, 0, -1));
    spawnBlock(world, new Scene(), "#FFF", 0, 1, 3, new Vector3(0, 0, -1));

    const pawn = makePawn(world, new Vector3(-1, 0, -2));
    shootingSystem(world, grid);
    const firstBlock = world.gridToEntity.get(toFlat(0, 0, 3))!;
    expect(hasTag(world, firstBlock, "destroy")).toBe(true);

    world.positions.get(pawn)!.set(0, 0, -2);
    shootingSystem(world, grid);

    const secondBlock = world.gridToEntity.get(toFlat(0, 1, 3))!;
    expect(hasTag(world, secondBlock, "destroy")).toBe(true);
  });

  it("fires again after turning a corner, even though the lane number repeats", () => {
    const world = createWorld();
    const grid = makeGrid();
    // Bottom edge, column 2 (x = 1) and right edge, row 2 (z = 1) share the
    // numeric lane index 2 but are different lanes.
    spawnBlock(world, new Scene(), "#FFF", 0, 2, 3, new Vector3(1, 0, -1));
    spawnBlock(world, new Scene(), "#FFF", 2, 2, 3, new Vector3(1, 0, 1));

    const pawn = makePawn(world, new Vector3(1, 0, -2));
    shootingSystem(world, grid);
    const firstBlock = world.gridToEntity.get(toFlat(0, 2, 3))!;
    expect(hasTag(world, firstBlock, "destroy")).toBe(true);

    // Move around the corner onto the right edge, still at lane index 2.
    world.positions.get(pawn)!.set(2, 0, 1);
    shootingSystem(world, grid);

    const secondBlock = world.gridToEntity.get(toFlat(2, 2, 3))!;
    expect(hasTag(world, secondBlock, "destroy")).toBe(true);
  });

  it("does nothing when the lane is empty", () => {
    const world = createWorld();
    const grid = makeGrid();

    makePawn(world, new Vector3(0, 0, -2));

    expect(() => shootingSystem(world, grid)).not.toThrow();
    expect(world.events).toEqual([]);
  });

  it("ignores pawns whose path following is done", () => {
    const world = createWorld();
    const grid = makeGrid();
    const block = spawnBlock(
      world,
      new Scene(),
      "#FFF",
      0,
      1,
      3,
      new Vector3(0, 0, -1),
    );

    const pawn = makePawn(world, new Vector3(0, 0, -2));
    world.pathFollowers.get(pawn)!.done = true;

    shootingSystem(world, grid);

    expect(hasTag(world, block, "destroy")).toBe(false);
    expect(world.events).toEqual([]);
  });

  it("ignores followers without a position", () => {
    const world = createWorld();
    const grid = makeGrid();
    const pawn = createEntity();
    const pathEntity = createEntity();
    world.pathFollowers.set(pawn, PathFollower(pathEntity, 1));

    expect(() => shootingSystem(world, grid)).not.toThrow();
    expect(world.events).toEqual([]);
  });

  it("destroys the pawn and emits a depleted pawn-resolved once ammo runs out on a hit", () => {
    const world = createWorld();
    const grid = makeGrid();
    const block = spawnBlock(
      world,
      new Scene(),
      "#FFF",
      0,
      1,
      3,
      new Vector3(0, 0, -1),
    );

    const pawn = makePawn(world, new Vector3(0, 0, -2), 1);
    world.colors.set(pawn, "#FFF");

    shootingSystem(world, grid);

    expect(hasTag(world, block, "destroy")).toBe(true);
    expect(hasTag(world, pawn, "destroy")).toBe(true);
    expect(world.events).toEqual([
      { type: "pawn-resolved", entity: pawn, depleted: true },
    ]);
    expect(world.ammo.get(pawn)).toBe(0);
  });

  it("decrements ammo on a hit without destroying the pawn while rounds remain", () => {
    const world = createWorld();
    const grid = makeGrid();
    const block = spawnBlock(
      world,
      new Scene(),
      "#FFF",
      0,
      1,
      3,
      new Vector3(0, 0, -1),
    );

    const pawn = makePawn(world, new Vector3(0, 0, -2), 2);
    world.colors.set(pawn, "#FFF");

    shootingSystem(world, grid);

    expect(hasTag(world, block, "destroy")).toBe(true);
    expect(hasTag(world, pawn, "destroy")).toBe(false);
    expect(world.events).toEqual([]);
    expect(world.ammo.get(pawn)).toBe(1);
  });

  it("leaves ammo untracked for pawns with no ammo component", () => {
    const world = createWorld();
    const grid = makeGrid();
    const block = spawnBlock(
      world,
      new Scene(),
      "#FFF",
      0,
      1,
      3,
      new Vector3(0, 0, -1),
    );

    const pawn = makePawn(world, new Vector3(0, 0, -2));
    world.colors.set(pawn, "#FFF");

    shootingSystem(world, grid);

    expect(hasTag(world, block, "destroy")).toBe(true);
    expect(world.events).toEqual([]);
    expect(world.ammo.has(pawn)).toBe(false);
  });
});
