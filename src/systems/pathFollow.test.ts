import { describe, it, expect } from "vitest";
import { Vector3 } from "three";
import { createWorld } from "../core/World";
import { createEntity } from "../core/Entity";
import { Position } from "../core/Position";
import { Path, PathFollower } from "../core/Path";
import { hasTag } from "../core/Tag";
import { pathFollowSystem } from "./pathFollow";
import { TRACK_END_T, TRACK_START_T } from "../constants";

function makeSquarePath() {
  return Path([
    Position(0, 0, 0),
    Position(1, 0, 0),
    Position(1, 0, 1),
    Position(0, 0, 1),
  ]);
}

describe("pathFollowSystem", () => {
  it("advances a follower's t (from TRACK_START_T) and moves its position partway along the first segment", () => {
    const world = createWorld();
    const pathEntity = createEntity();
    world.paths.set(pathEntity, makeSquarePath());

    const follower = createEntity();
    world.pathFollowers.set(follower, PathFollower(pathEntity, 1));
    world.positions.set(follower, Position(0, 0, 0));

    pathFollowSystem(world, 0.5);

    const data = world.pathFollowers.get(follower)!;
    expect(data.t).toBeCloseTo(TRACK_START_T + 0.125);
    expect(data.done).toBe(false);

    const pos = world.positions.get(follower)!;
    expect(pos.x).toBeCloseTo(0.9);
    expect(pos.y).toBeCloseTo(0);
    expect(pos.z).toBeCloseTo(0);
  });

  it("lands on a path vertex when t reaches a segment boundary", () => {
    const world = createWorld();
    const pathEntity = createEntity();
    world.paths.set(pathEntity, makeSquarePath());

    const follower = createEntity();
    world.pathFollowers.set(follower, PathFollower(pathEntity, 2));
    world.positions.set(follower, Position(0, 0, 0));

    // increment = (2 * 0.3) / 4 = 0.15, so t = TRACK_START_T + 0.15 = 0.25 -> vertex 1
    pathFollowSystem(world, 0.3);

    const data = world.pathFollowers.get(follower)!;
    expect(data.t).toBeCloseTo(0.25);

    const pos = world.positions.get(follower)!;
    expect(pos.x).toBeCloseTo(1);
    expect(pos.y).toBeCloseTo(0);
    expect(pos.z).toBeCloseTo(0);
  });

  it("continues sampling correctly across multiple ticks and segments", () => {
    const world = createWorld();
    const pathEntity = createEntity();
    world.paths.set(pathEntity, makeSquarePath());

    const follower = createEntity();
    world.pathFollowers.set(follower, PathFollower(pathEntity, 2));
    world.positions.set(follower, Position(0, 0, 0));

    // each tick: increment = (2 * 0.4) / 4 = 0.2; t = TRACK_START_T + 0.2 + 0.2 = 0.5 -> vertex 2
    pathFollowSystem(world, 0.4);
    pathFollowSystem(world, 0.4);

    const data = world.pathFollowers.get(follower)!;
    expect(data.t).toBeCloseTo(0.5);

    const pos = world.positions.get(follower)!;
    expect(pos.x).toBeCloseTo(1);
    expect(pos.y).toBeCloseTo(0);
    expect(pos.z).toBeCloseTo(1);
  });

  it("clamps t to TRACK_END_T, marks the follower done, and stops moving it further", () => {
    const world = createWorld();
    const pathEntity = createEntity();
    world.paths.set(pathEntity, makeSquarePath());

    const follower = createEntity();
    world.pathFollowers.set(follower, PathFollower(pathEntity, 100));
    world.positions.set(follower, Position(0, 0, 0));

    pathFollowSystem(world, 1);

    const data = world.pathFollowers.get(follower)!;
    expect(data.t).toBe(TRACK_END_T);
    expect(data.done).toBe(true);

    const pos = world.positions.get(follower)!;
    expect(pos.x).toBeCloseTo(0);
    expect(pos.y).toBeCloseTo(0);
    expect(pos.z).toBeCloseTo(0.4);

    const posBefore = pos.clone();
    pathFollowSystem(world, 1);
    expect(world.positions.get(follower)!.equals(posBefore)).toBe(true);
    expect(world.pathFollowers.get(follower)!.t).toBe(TRACK_END_T);
  });

  it("marks the follower destroyed and emits exactly one pawn-resolved event when it completes the loop", () => {
    const world = createWorld();
    const pathEntity = createEntity();
    world.paths.set(pathEntity, makeSquarePath());

    const follower = createEntity();
    world.pathFollowers.set(follower, PathFollower(pathEntity, 100));
    world.positions.set(follower, Position(0, 0, 0));

    pathFollowSystem(world, 1);
    expect(hasTag(world, follower, "destroy")).toBe(true);
    expect(world.events).toEqual([
      { type: "pawn-resolved", entity: follower, depleted: false },
    ]);

    pathFollowSystem(world, 1);
    expect(world.events).toEqual([
      { type: "pawn-resolved", entity: follower, depleted: false },
    ]);
  });

  it("moves multiple followers on the same path independently", () => {
    const world = createWorld();
    const pathEntity = createEntity();
    world.paths.set(pathEntity, makeSquarePath());

    const slow = createEntity();
    world.pathFollowers.set(slow, PathFollower(pathEntity, 1));
    world.positions.set(slow, Position(0, 0, 0));

    const fast = createEntity();
    world.pathFollowers.set(fast, PathFollower(pathEntity, 4));
    world.positions.set(fast, Position(0, 0, 0));

    pathFollowSystem(world, 0.5);

    expect(world.pathFollowers.get(slow)!.t).toBeCloseTo(TRACK_START_T + 0.125);
    expect(world.pathFollowers.get(fast)!.t).toBeCloseTo(TRACK_START_T + 0.5);

    const slowPos = world.positions.get(slow)!;
    expect(slowPos.x).toBeCloseTo(0.9);
    expect(slowPos.y).toBeCloseTo(0);
    expect(slowPos.z).toBeCloseTo(0);

    const fastPos = world.positions.get(fast)!;
    expect(fastPos.x).toBeCloseTo(0.6);
    expect(fastPos.y).toBeCloseTo(0);
    expect(fastPos.z).toBeCloseTo(1);
  });

  it("does not throw and leaves state untouched when the referenced path is missing", () => {
    const world = createWorld();
    const missingPathId = createEntity();

    const follower = createEntity();
    world.pathFollowers.set(follower, PathFollower(missingPathId, 1));
    const startPosition = Position(3, 0, 3);
    world.positions.set(follower, startPosition);

    expect(() => pathFollowSystem(world, 1)).not.toThrow();
    expect(world.positions.get(follower)).toBe(startPosition);
    expect(world.positions.get(follower)!.equals(new Vector3(3, 0, 3))).toBe(true);
  });

  it("does not throw when the follower entity has no position component", () => {
    const world = createWorld();
    const pathEntity = createEntity();
    world.paths.set(pathEntity, makeSquarePath());

    const follower = createEntity();
    world.pathFollowers.set(follower, PathFollower(pathEntity, 1));

    expect(() => pathFollowSystem(world, 1)).not.toThrow();
  });
});
