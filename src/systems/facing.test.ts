import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { createWorld, type World } from "../core/World";
import { createEntity, type Entity } from "../core/Entity";
import { BLOCK_SIZE, GRID_COLUMNS, GRID_ROWS } from "../constants";
import type { Grid } from "../core/Grid";
import { Path, PathFollower } from "../core/Path";
import { Rotation } from "../core/Rotation";
import { addTag } from "../core/Tag";
import { ScalarTween } from "../core/Tween";
import { facingSystem, snapToPathDirection } from "./facing";

const GRID: Grid = {
  columns: GRID_COLUMNS,
  rows: GRID_ROWS,
  cellSize: BLOCK_SIZE,
  center: new Vector3(0, 0, 0),
  palette: ["koi", "tide"],
};

/** An L: runs along +X, then turns to run along +Z. */
function makeWorld(): { world: World; pathEntity: Entity; pawn: Entity } {
  const world = createWorld();

  const pathEntity = createEntity();
  world.paths.set(
    pathEntity,
    Path([new Vector3(0, 0, 0), new Vector3(10, 0, 0), new Vector3(10, 0, 10)]),
  );

  const pawn = createEntity();
  world.positions.set(pawn, new Vector3());
  world.rotations.set(pawn, Rotation());
  world.pathFollowers.set(pawn, PathFollower(pathEntity));

  return { world, pathEntity, pawn };
}

const EAST = Math.PI / 2; // heading of +X
const WEST = -Math.PI / 2;
const NORTH = 0; // heading of +Z
const SOUTH = Math.PI;

/** Runs the system long enough for any turn to complete. */
function settle(world: World) {
  for (let i = 0; i < 200; i++) facingSystem(world, GRID, 1 / 60);
}

describe("facingSystem", () => {
  it("steers a follower toward the track direction under it", () => {
    const { world, pawn } = makeWorld();
    const rotation = world.rotations.get(pawn)!;

    facingSystem(world, GRID, 0.001);

    expect(rotation.target).toBeCloseTo(EAST, 6);
  });

  it("turns at its own rate rather than snapping", () => {
    const { world, pawn } = makeWorld();
    const rotation = world.rotations.get(pawn)!;
    rotation.turnSpeed = 1;

    facingSystem(world, GRID, 0.1);

    expect(rotation.yaw).toBeCloseTo(0.1, 6);
    expect(rotation.yaw).not.toBeCloseTo(EAST, 2);
  });

  it("arrives at the new heading after a corner", () => {
    const { world, pawn } = makeWorld();
    const rotation = world.rotations.get(pawn)!;

    // Past the corner, on the leg running along +Z.
    world.pathFollowers.get(pawn)!.t = 0.75;
    settle(world);

    expect(rotation.yaw).toBeCloseTo(NORTH, 4);
  });

  it("faces the field once the pawn has fired, not the track", () => {
    const { world, pawn } = makeWorld();
    const rotation = world.rotations.get(pawn)!;

    // South of the grid, travelling east along the track.
    world.positions.get(pawn)!.set(0, 0, 10);
    addTag(world, pawn, "aiming");
    settle(world);

    expect(rotation.yaw).toBeCloseTo(SOUTH, 4);
  });

  it("keeps facing the grid across a corner onto a new side", () => {
    // The whole point of re-deriving the aim each frame: a heading frozen at
    // the first shot would still point south long after the pawn turned up the
    // east side, where the grid is to its west.
    const { world, pawn } = makeWorld();
    const rotation = world.rotations.get(pawn)!;
    const position = world.positions.get(pawn)!;

    position.set(0, 0, 10);
    addTag(world, pawn, "aiming");
    settle(world);
    expect(rotation.yaw).toBeCloseTo(SOUTH, 4);

    // Rounded the corner: now east of the grid.
    position.set(10, 0, 0);
    settle(world);

    expect(rotation.yaw).toBeCloseTo(WEST, 4);
  });

  it("never lets the track take an aiming pawn back", () => {
    const { world, pawn } = makeWorld();
    const rotation = world.rotations.get(pawn)!;
    const follower = world.pathFollowers.get(pawn)!;

    world.positions.get(pawn)!.set(0, 0, 10);
    addTag(world, pawn, "aiming");

    // Walk the follower across the corner, where the track tangent swings from
    // +X to +Z. The pawn must not follow it.
    for (let i = 0; i <= 100; i++) {
      follower.t = i / 100;
      facingSystem(world, GRID, 1 / 60);
      expect(rotation.target).toBeCloseTo(SOUTH, 6);
    }
  });

  it("faces the field square on, never at an angle to it", () => {
    // Standing off a corner of the grid, where the exact direction to the
    // centre is a 45° diagonal: the aim still resolves to one cardinal.
    const { world, pawn } = makeWorld();
    const rotation = world.rotations.get(pawn)!;

    world.positions.get(pawn)!.set(-6, 0, 6.5);
    addTag(world, pawn, "aiming");
    settle(world);

    const quarters = rotation.yaw / (Math.PI / 2);
    expect(quarters).toBeCloseTo(Math.round(quarters), 5);
  });

  it("leaves a finished follower's heading alone", () => {
    const { world, pawn } = makeWorld();
    const rotation = world.rotations.get(pawn)!;
    rotation.target = NORTH;
    rotation.yaw = NORTH;
    world.pathFollowers.get(pawn)!.done = true;

    facingSystem(world, GRID, 1 / 60);

    expect(rotation.target).toBeCloseTo(NORTH, 6);
  });
});

describe("snapToPathDirection", () => {
  /**
   * The loop is over every rotation in the world, not just the pawns' — a life
   * pearl has one too. A yaw being tweened is that tween's to write, and
   * stepping it toward a heading here would cancel the spin out.
   */
  it("leaves a tweened yaw to its tween", () => {
    const { world } = makeWorld();
    const spinner = createEntity();
    world.rotations.set(spinner, Rotation(0));
    world.rotationTweens.set(spinner, ScalarTween(0, Math.PI, 1));

    settle(world);

    expect(world.rotations.get(spinner)!.yaw).toBe(0);
  });

  it("aligns with the track with no turn in between", () => {
    const { world, pathEntity, pawn } = makeWorld();
    const rotation = world.rotations.get(pawn)!;
    rotation.yaw = Math.PI;

    snapToPathDirection(world, pawn, world.paths.get(pathEntity)!, 0);

    expect(rotation.yaw).toBeCloseTo(EAST, 6);
    expect(rotation.target).toBeCloseTo(EAST, 6);
  });

  it("ignores an entity that has no rotation", () => {
    const { world, pathEntity } = makeWorld();
    const bare = createEntity();

    expect(() =>
      snapToPathDirection(world, bare, world.paths.get(pathEntity)!, 0),
    ).not.toThrow();
  });
});
