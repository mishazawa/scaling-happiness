import { describe, it, expect } from "vitest";
import { Scene, Vector3 } from "three";
import { createWorld } from "../core/World";
import { createEntity } from "../core/Entity";
import { Position } from "../core/Position";
import { PathFollower } from "../core/Path";
import { addTag, hasTag } from "../core/Tag";
import { spawnBlock } from "../setup/block";
import type { Grid } from "../core/Grid";
import type { SystemContext } from "./context";
import { toFlat } from "../utils/gridMath";
import { shootingSystem } from "./shooting";

function makeGrid(): Grid {
  return {
    columns: 3,
    rows: 3,
    cellSize: 1,
    center: new Vector3(0, 0, 0),
    palette: ["koi", "tide"],
  };
}

function makeCtx(): SystemContext {
  return { scene: new Scene(), pathEntity: createEntity() };
}

/**
 * A block on the 3x3 test grid. Flag and palette are deliberately unrelated:
 * every block here matches `makePawn`'s flag, and the palette is fixed so it
 * cannot be what a passing test is keying off.
 */
function makeBlock(
  world: ReturnType<typeof createWorld>,
  row: number,
  column: number,
  position: Vector3,
  flag = "light",
) {
  return spawnBlock(world, {
    flag,
    palette: "koi",
    row,
    column,
    totalColumns: 3,
    position,
  });
}

function makePawn(
  world: ReturnType<typeof createWorld>,
  position: Vector3,
  ammo?: number,
  flag = "light",
) {
  const pawn = createEntity();
  world.positions.set(pawn, Position(position.x, position.y, position.z));
  world.flags.set(pawn, flag);
  const pathEntity = createEntity();
  world.pathFollowers.set(pawn, PathFollower(pathEntity, 1));
  if (ammo !== undefined) world.ammo.set(pawn, ammo);
  return pawn;
}

describe("shootingSystem", () => {
  it("targets the frontmost block in the lane a pawn on the bottom edge faces", () => {
    const world = createWorld();
    const grid = makeGrid();
    // column 1 (x = 0), rows 0..2 all occupied.
    makeBlock(world, 0, 1, new Vector3(0, 0, -1));
    makeBlock(world, 1, 1, new Vector3(0, 0, 0));
    makeBlock(world, 2, 1, new Vector3(0, 0, 1));

    // Below the grid (smaller z), facing inward toward increasing row.
    makePawn(world, new Vector3(0, 0, -2));

    shootingSystem(world, grid, makeCtx());

    const block = world.gridToEntity.get(toFlat(0, 1, 3))!;
    expect(hasTag(world, block, "targeted")).toBe(true);
    expect(hasTag(world, block, "destroy")).toBe(false);
    expect(world.events).toEqual([]);
  });

  it("stores the target as a flat grid cell index, not the block entity", () => {
    const world = createWorld();
    const grid = makeGrid();
    const block = makeBlock(world, 0, 1, new Vector3(0, 0, -1));

    makePawn(world, new Vector3(0, 0, -2));
    shootingSystem(world, grid, makeCtx());

    const [projectile] = world.projectileTargets.keys();
    expect(world.projectileTargets.get(projectile)).toBe(toFlat(0, 1, 3));
    expect(world.projectileTargets.get(projectile)).not.toBe(block);
  });

  it("fires from the nearest edge, skipping already-empty cells closer to the track", () => {
    const world = createWorld();
    const grid = makeGrid();
    // Only row 2 (farthest from the bottom edge) is occupied in column 1.
    makeBlock(world, 2, 1, new Vector3(0, 0, 1));

    makePawn(world, new Vector3(0, 0, -2));

    shootingSystem(world, grid, makeCtx());

    const block = world.gridToEntity.get(toFlat(2, 1, 3))!;
    expect(hasTag(world, block, "targeted")).toBe(true);
  });

  it("fires inward from the top edge, starting at the highest row index", () => {
    const world = createWorld();
    const grid = makeGrid();
    makeBlock(world, 0, 1, new Vector3(0, 0, -1));
    makeBlock(world, 2, 1, new Vector3(0, 0, 1));

    makePawn(world, new Vector3(0, 0, 2));

    shootingSystem(world, grid, makeCtx());

    const block = world.gridToEntity.get(toFlat(2, 1, 3))!;
    expect(hasTag(world, block, "targeted")).toBe(true);
  });

  it("fires inward from the left/right edges along the row axis", () => {
    const world = createWorld();
    const grid = makeGrid();
    makeBlock(world, 1, 0, new Vector3(-1, 0, 0));
    makeBlock(world, 1, 2, new Vector3(1, 0, 0));

    makePawn(world, new Vector3(-2, 0, 0));

    shootingSystem(world, grid, makeCtx());

    const block = world.gridToEntity.get(toFlat(1, 0, 3))!;
    expect(hasTag(world, block, "targeted")).toBe(true);
  });

  it("does not fire again while the pawn stays in the same lane", () => {
    const world = createWorld();
    const grid = makeGrid();
    makeBlock(world, 0, 1, new Vector3(0, 0, -1));

    makePawn(world, new Vector3(0, 0, -2));

    shootingSystem(world, grid, makeCtx());
    const block = world.gridToEntity.get(toFlat(0, 1, 3))!;
    expect(hasTag(world, block, "targeted")).toBe(true);
    const projectileCountAfterFirst = world.projectileTargets.size;

    shootingSystem(world, grid, makeCtx());

    // No second projectile spawned — the lastFiredLanes gate, not occlusion,
    // is what stopped this (the block is still targeted either way, so we
    // assert on projectile count to isolate the mechanism being tested).
    expect(world.projectileTargets.size).toBe(projectileCountAfterFirst);
  });

  it("skips a lane whose block is already targeted, without touching ammo", () => {
    const world = createWorld();
    const grid = makeGrid();
    const block = makeBlock(world, 0, 1, new Vector3(0, 0, -1));
    addTag(world, block, "targeted");

    const pawn = makePawn(world, new Vector3(0, 0, -2), 5);

    shootingSystem(world, grid, makeCtx());

    expect(world.projectileTargets.size).toBe(0);
    expect(world.ammo.get(pawn)).toBe(5);
    expect(world.events).toEqual([]);
  });

  it("fires again once the pawn moves to a new lane", () => {
    const world = createWorld();
    const grid = makeGrid();
    makeBlock(world, 0, 0, new Vector3(-1, 0, -1));
    makeBlock(world, 0, 1, new Vector3(0, 0, -1));

    const pawn = makePawn(world, new Vector3(-1, 0, -2));
    shootingSystem(world, grid, makeCtx());
    const firstBlock = world.gridToEntity.get(toFlat(0, 0, 3))!;
    expect(hasTag(world, firstBlock, "targeted")).toBe(true);

    world.positions.get(pawn)!.set(0, 0, -2);
    shootingSystem(world, grid, makeCtx());

    const secondBlock = world.gridToEntity.get(toFlat(0, 1, 3))!;
    expect(hasTag(world, secondBlock, "targeted")).toBe(true);
  });

  it("fires again after turning a corner, even though the lane number repeats", () => {
    const world = createWorld();
    const grid = makeGrid();
    // Bottom edge, column 2 (x = 1) and right edge, row 2 (z = 1) share the
    // numeric lane index 2 but are different lanes.
    makeBlock(world, 0, 2, new Vector3(1, 0, -1));
    makeBlock(world, 2, 2, new Vector3(1, 0, 1));

    const pawn = makePawn(world, new Vector3(1, 0, -2));
    shootingSystem(world, grid, makeCtx());
    const firstBlock = world.gridToEntity.get(toFlat(0, 2, 3))!;
    expect(hasTag(world, firstBlock, "targeted")).toBe(true);

    // Move around the corner onto the right edge, still at lane index 2.
    world.positions.get(pawn)!.set(2, 0, 1);
    shootingSystem(world, grid, makeCtx());

    const secondBlock = world.gridToEntity.get(toFlat(2, 2, 3))!;
    expect(hasTag(world, secondBlock, "targeted")).toBe(true);
  });

  it("holds fire when the block's flag differs from the pawn's", () => {
    const world = createWorld();
    const grid = makeGrid();
    const target = makeBlock(world, 0, 1, new Vector3(0, 0, -1), "dark");

    const pawn = makePawn(world, new Vector3(0, 0, -2), 5, "light");

    shootingSystem(world, grid, makeCtx());

    expect(hasTag(world, target, "targeted")).toBe(false);
    expect(world.projectileTargets.size).toBe(0);
    expect(world.ammo.get(pawn)).toBe(5);
  });

  it("matches on the flag alone, not on how either side is drawn", () => {
    // The whole point of the flag: a block and a pawn that share it still
    // trade fire even when their palettes have nothing to do with each other.
    const world = createWorld();
    const grid = makeGrid();
    const target = spawnBlock(world, {
      flag: "light",
      palette: "mermaid",
      row: 0,
      column: 1,
      totalColumns: 3,
      position: new Vector3(0, 0, -1),
    });

    makePawn(world, new Vector3(0, 0, -2), 5, "light");

    shootingSystem(world, grid, makeCtx());

    expect(hasTag(world, target, "targeted")).toBe(true);
  });

  it("holds fire for a pawn carrying no flag at all", () => {
    // Two entities that are both flagless must not read as a match.
    const world = createWorld();
    const grid = makeGrid();
    const target = makeBlock(world, 0, 1, new Vector3(0, 0, -1));
    world.flags.delete(target);

    const pawn = makePawn(world, new Vector3(0, 0, -2), 5);
    world.flags.delete(pawn);

    shootingSystem(world, grid, makeCtx());

    expect(hasTag(world, target, "targeted")).toBe(false);
    expect(world.projectileTargets.size).toBe(0);
  });

  it("does nothing when the lane is empty", () => {
    const world = createWorld();
    const grid = makeGrid();

    makePawn(world, new Vector3(0, 0, -2));

    expect(() => shootingSystem(world, grid, makeCtx())).not.toThrow();
    expect(world.events).toEqual([]);
  });

  it("ignores pawns whose path following is done", () => {
    const world = createWorld();
    const grid = makeGrid();
    const block = makeBlock(world, 0, 1, new Vector3(0, 0, -1));

    const pawn = makePawn(world, new Vector3(0, 0, -2));
    world.pathFollowers.get(pawn)!.done = true;

    shootingSystem(world, grid, makeCtx());

    expect(hasTag(world, block, "targeted")).toBe(false);
    expect(world.events).toEqual([]);
  });

  it("ignores followers without a position", () => {
    const world = createWorld();
    const grid = makeGrid();
    const pawn = createEntity();
    const pathEntity = createEntity();
    world.pathFollowers.set(pawn, PathFollower(pathEntity, 1));

    expect(() => shootingSystem(world, grid, makeCtx())).not.toThrow();
    expect(world.events).toEqual([]);
  });

  it("destroys the pawn and emits a depleted pawn-resolved once ammo runs out on a hit", () => {
    const world = createWorld();
    const grid = makeGrid();
    const block = makeBlock(world, 0, 1, new Vector3(0, 0, -1));

    const pawn = makePawn(world, new Vector3(0, 0, -2), 1);
    world.flags.set(pawn, "light");

    shootingSystem(world, grid, makeCtx());

    expect(hasTag(world, block, "targeted")).toBe(true);
    expect(hasTag(world, block, "destroy")).toBe(false);
    expect(hasTag(world, pawn, "destroy")).toBe(true);
    expect(world.events).toEqual([
      { type: "pawn-resolved", entity: pawn, depleted: true },
    ]);
    expect(world.ammo.get(pawn)).toBe(0);
  });

  it("decrements ammo on a hit without destroying the pawn while rounds remain", () => {
    const world = createWorld();
    const grid = makeGrid();
    const block = makeBlock(world, 0, 1, new Vector3(0, 0, -1));

    const pawn = makePawn(world, new Vector3(0, 0, -2), 2);
    world.flags.set(pawn, "light");

    shootingSystem(world, grid, makeCtx());

    expect(hasTag(world, block, "targeted")).toBe(true);
    expect(hasTag(world, pawn, "destroy")).toBe(false);
    expect(world.events).toEqual([]);
    expect(world.ammo.get(pawn)).toBe(1);
  });

  it("leaves ammo untracked for pawns with no ammo component", () => {
    const world = createWorld();
    const grid = makeGrid();
    const block = makeBlock(world, 0, 1, new Vector3(0, 0, -1));

    const pawn = makePawn(world, new Vector3(0, 0, -2));
    world.flags.set(pawn, "light");

    shootingSystem(world, grid, makeCtx());

    expect(hasTag(world, block, "targeted")).toBe(true);
    expect(world.events).toEqual([]);
    expect(world.ammo.has(pawn)).toBe(false);
  });
});
