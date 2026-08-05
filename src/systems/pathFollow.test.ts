import { describe, it, expect } from "vitest";
import { Vector3 } from "three";
import { createWorld } from "../core/World";
import { createEntity } from "../core/Entity";
import { Position } from "../core/Position";
import { Path, PathFollower, type PathData } from "../core/Path";
import { hasTag } from "../core/Tag";
import { pathFollowSystem } from "./pathFollow";
import { samplePath } from "../utils/path";
import { TRACK_END_T, TRACK_START_T } from "../constants";

function makeSquarePath() {
  return Path([
    Position(0, 0, 0),
    Position(1, 0, 0),
    Position(1, 0, 1),
    Position(0, 0, 1),
  ]);
}

/** t after one tick, following the same formula as pathFollowSystem. */
function advance(startT: number, speed: number, dt: number, path: PathData) {
  return startT + (speed * dt) / path.total;
}

/** dt required to move a follower from TRACK_START_T to `targetT`, at `speed`. */
function dtToReach(targetT: number, speed: number, path: PathData) {
  return ((targetT - TRACK_START_T) * path.total) / speed;
}

describe("pathFollowSystem", () => {
  it("advances a follower's t from TRACK_START_T and samples the matching position", () => {
    const world = createWorld();
    const pathEntity = createEntity();
    const path = makeSquarePath();
    world.paths.set(pathEntity, path);

    const speed = 1;
    const dt = 0.5;
    const follower = createEntity();
    world.pathFollowers.set(follower, PathFollower(pathEntity, speed));
    world.positions.set(follower, Position(0, 0, 0));

    pathFollowSystem(world, dt);

    const expectedT = advance(TRACK_START_T, speed, dt, path);
    const data = world.pathFollowers.get(follower)!;
    expect(data.t).toBeCloseTo(expectedT);
    expect(data.done).toBe(expectedT >= TRACK_END_T);

    const expectedPos = samplePath(path, expectedT).clone();
    const pos = world.positions.get(follower)!;
    expect(pos.x).toBeCloseTo(expectedPos.x);
    expect(pos.y).toBeCloseTo(expectedPos.y);
    expect(pos.z).toBeCloseTo(expectedPos.z);
  });

  it("lands on a path vertex when t reaches a segment boundary", () => {
    const world = createWorld();
    const pathEntity = createEntity();
    const path = makeSquarePath();
    world.paths.set(pathEntity, path);

    const speed = 2;
    // end of the first segment, wherever that falls along the path
    const targetT = path.segLengths[0] / path.total;
    const dt = dtToReach(targetT, speed, path);

    const follower = createEntity();
    world.pathFollowers.set(follower, PathFollower(pathEntity, speed));
    world.positions.set(follower, Position(0, 0, 0));

    pathFollowSystem(world, dt);

    const data = world.pathFollowers.get(follower)!;
    expect(data.t).toBeCloseTo(targetT);

    const expectedPos = path.points[1]; // the vertex ending segment 0
    const pos = world.positions.get(follower)!;
    expect(pos.x).toBeCloseTo(expectedPos.x);
    expect(pos.y).toBeCloseTo(expectedPos.y);
    expect(pos.z).toBeCloseTo(expectedPos.z);
  });

  it("continues sampling correctly across multiple ticks and segments", () => {
    const world = createWorld();
    const pathEntity = createEntity();
    const path = makeSquarePath();
    world.paths.set(pathEntity, path);

    const speed = 2;
    // end of the second segment
    const targetT = (path.segLengths[0] + path.segLengths[1]) / path.total;
    const dt = dtToReach(targetT, speed, path) / 2; // split into two equal ticks

    const follower = createEntity();
    world.pathFollowers.set(follower, PathFollower(pathEntity, speed));
    world.positions.set(follower, Position(0, 0, 0));

    pathFollowSystem(world, dt);
    pathFollowSystem(world, dt);

    const data = world.pathFollowers.get(follower)!;
    expect(data.t).toBeCloseTo(targetT);

    const expectedPos = path.points[2]; // the vertex ending segment 1
    const pos = world.positions.get(follower)!;
    expect(pos.x).toBeCloseTo(expectedPos.x);
    expect(pos.y).toBeCloseTo(expectedPos.y);
    expect(pos.z).toBeCloseTo(expectedPos.z);
  });

  it("clamps t to TRACK_END_T, marks the follower done, and stops moving it further", () => {
    const world = createWorld();
    const pathEntity = createEntity();
    const path = makeSquarePath();
    world.paths.set(pathEntity, path);

    // any speed/dt whose raw increment overshoots TRACK_END_T from TRACK_START_T
    const speed = 100;
    const dt = 1;
    expect(advance(TRACK_START_T, speed, dt, path)).toBeGreaterThan(TRACK_END_T);

    const follower = createEntity();
    world.pathFollowers.set(follower, PathFollower(pathEntity, speed));
    world.positions.set(follower, Position(0, 0, 0));

    pathFollowSystem(world, dt);

    const data = world.pathFollowers.get(follower)!;
    expect(data.t).toBe(TRACK_END_T);
    expect(data.done).toBe(true);

    const expectedPos = samplePath(path, TRACK_END_T).clone();
    const pos = world.positions.get(follower)!;
    expect(pos.x).toBeCloseTo(expectedPos.x);
    expect(pos.y).toBeCloseTo(expectedPos.y);
    expect(pos.z).toBeCloseTo(expectedPos.z);

    const posBefore = pos.clone();
    pathFollowSystem(world, dt);
    expect(world.positions.get(follower)!.equals(posBefore)).toBe(true);
    expect(world.pathFollowers.get(follower)!.t).toBe(TRACK_END_T);
  });

  it("marks the follower destroyed and emits exactly one pawn-resolved event when it completes the loop", () => {
    const world = createWorld();
    const pathEntity = createEntity();
    const path = makeSquarePath();
    world.paths.set(pathEntity, path);

    const speed = 100;
    const dt = 1;
    expect(advance(TRACK_START_T, speed, dt, path)).toBeGreaterThan(TRACK_END_T);

    const follower = createEntity();
    world.pathFollowers.set(follower, PathFollower(pathEntity, speed));
    world.positions.set(follower, Position(0, 0, 0));

    pathFollowSystem(world, dt);
    expect(hasTag(world, follower, "destroy")).toBe(true);
    expect(world.events).toEqual([
      { type: "pawn-resolved", entity: follower, depleted: false },
    ]);

    pathFollowSystem(world, dt);
    expect(world.events).toEqual([
      { type: "pawn-resolved", entity: follower, depleted: false },
    ]);
  });

  it("moves multiple followers on the same path independently", () => {
    const world = createWorld();
    const pathEntity = createEntity();
    const path = makeSquarePath();
    world.paths.set(pathEntity, path);

    const slowSpeed = 1;
    const fastSpeed = 4;
    const dt = 0.5;

    const slow = createEntity();
    world.pathFollowers.set(slow, PathFollower(pathEntity, slowSpeed));
    world.positions.set(slow, Position(0, 0, 0));

    const fast = createEntity();
    world.pathFollowers.set(fast, PathFollower(pathEntity, fastSpeed));
    world.positions.set(fast, Position(0, 0, 0));

    pathFollowSystem(world, dt);

    const expectedSlowT = advance(TRACK_START_T, slowSpeed, dt, path);
    const expectedFastT = advance(TRACK_START_T, fastSpeed, dt, path);
    expect(world.pathFollowers.get(slow)!.t).toBeCloseTo(expectedSlowT);
    expect(world.pathFollowers.get(fast)!.t).toBeCloseTo(expectedFastT);

    const expectedSlowPos = samplePath(path, expectedSlowT).clone();
    const slowPos = world.positions.get(slow)!;
    expect(slowPos.x).toBeCloseTo(expectedSlowPos.x);
    expect(slowPos.y).toBeCloseTo(expectedSlowPos.y);
    expect(slowPos.z).toBeCloseTo(expectedSlowPos.z);

    const expectedFastPos = samplePath(path, expectedFastT).clone();
    const fastPos = world.positions.get(fast)!;
    expect(fastPos.x).toBeCloseTo(expectedFastPos.x);
    expect(fastPos.y).toBeCloseTo(expectedFastPos.y);
    expect(fastPos.z).toBeCloseTo(expectedFastPos.z);
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
