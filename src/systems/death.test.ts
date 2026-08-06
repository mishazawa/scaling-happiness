import { describe, it, expect } from "vitest";
import { Scene, Vector3 } from "three";
import {
  PAWN_DEATH_DURATION,
  PAWN_DEATH_END_SCALE,
  PAWN_DEATH_RISE_SPEED,
  PAWN_DEATH_SPIN_SPEED,
} from "../constants";
import { createEntity, type Entity } from "../core/Entity";
import type { Grid } from "../core/Grid";
import { PathFollower } from "../core/Path";
import { Position } from "../core/Position";
import { Rotation } from "../core/Rotation";
import { DEFAULT_SCALE } from "../core/Scale";
import { addTag, hasTag } from "../core/Tag";
import { createWorld, type World } from "../core/World";
import { spawnBlock } from "../setup/block";
import { clearEventsSystem } from "./clearEvents";
import type { SystemContext } from "./context";
import { deathSystem } from "./death";
import { facingSystem } from "./facing";
import { garbageCollectionSystem } from "./garbageCollection";
import { lifeSystem } from "./life";
import { shootingSystem } from "./shooting";
import { timerSystem } from "./timer";

function makePawn(world: World, position = new Vector3(0, 0, 0)) {
  const pawn = createEntity();
  world.positions.set(pawn, Position(position.x, position.y, position.z));
  world.rotations.set(pawn, Rotation(0));
  addTag(world, pawn, "pawn");
  return pawn;
}

/** Feeds deathSystem the one event that starts a death, then clears the frame. */
function resolve(world: World, entity: Entity) {
  world.events.push({ type: "pawn-resolved", entity, depleted: false });
  deathSystem(world);
  world.events = [];
}

describe("deathSystem", () => {
  it("starts the three death tweens on a resolved pawn and tags it dying", () => {
    const world = createWorld();
    const pawn = makePawn(world, new Vector3(1, 0, 2));
    world.rotations.set(pawn, Rotation(0.25));

    resolve(world, pawn);

    expect(hasTag(world, pawn, "dying")).toBe(true);
    expect(hasTag(world, pawn, "destroy")).toBe(false);
    expect(world.scales.get(pawn)).toBe(DEFAULT_SCALE);

    expect(world.scaleTweens.get(pawn)).toEqual({
      from: DEFAULT_SCALE,
      to: PAWN_DEATH_END_SCALE,
      elapsed: 0,
      duration: PAWN_DEATH_DURATION,
    });

    // A fixed sweep at the configured rate, off whatever yaw the pawn died on.
    expect(world.rotationTweens.get(pawn)).toEqual({
      from: 0.25,
      to: 0.25 + PAWN_DEATH_SPIN_SPEED * PAWN_DEATH_DURATION,
      elapsed: 0,
      duration: PAWN_DEATH_DURATION,
    });

    const rise = world.positionTweens.get(pawn)!;
    expect(rise.duration).toBe(PAWN_DEATH_DURATION);
    expect(rise.from).toEqual(new Vector3(1, 0, 2));
    expect(rise.to).toEqual(
      new Vector3(1, PAWN_DEATH_RISE_SPEED * PAWN_DEATH_DURATION, 2),
    );
  });

  it("stops a dying pawn's follower so nothing steers it while it animates", () => {
    const world = createWorld();
    const pawn = makePawn(world);
    world.pathFollowers.set(pawn, PathFollower(createEntity(), 1));

    resolve(world, pawn);

    expect(world.pathFollowers.get(pawn)!.done).toBe(true);
  });

  it("spins, rises and shrinks to nothing over exactly the death duration", () => {
    const world = createWorld();
    const pawn = makePawn(world, new Vector3(0, 0, 0));

    resolve(world, pawn);

    timerSystem(world, PAWN_DEATH_DURATION / 2);
    expect(world.scales.get(pawn)).toBeCloseTo(DEFAULT_SCALE / 2);
    expect(world.rotations.get(pawn)!.yaw).toBeCloseTo(
      (PAWN_DEATH_SPIN_SPEED * PAWN_DEATH_DURATION) / 2,
    );
    expect(world.positions.get(pawn)!.y).toBeCloseTo(
      (PAWN_DEATH_RISE_SPEED * PAWN_DEATH_DURATION) / 2,
    );
    // Halfway through is still mid-animation: nothing torn down yet.
    expect(hasTag(world, pawn, "destroy")).toBe(false);

    timerSystem(world, PAWN_DEATH_DURATION / 2);
    expect(world.scales.get(pawn)).toBe(PAWN_DEATH_END_SCALE);
    expect(world.rotations.get(pawn)!.yaw).toBeCloseTo(
      PAWN_DEATH_SPIN_SPEED * PAWN_DEATH_DURATION,
    );
    expect(world.positions.get(pawn)!.y).toBeCloseTo(
      PAWN_DEATH_RISE_SPEED * PAWN_DEATH_DURATION,
    );

    deathSystem(world);
    expect(hasTag(world, pawn, "destroy")).toBe(true);
  });

  it("leaves a dying pawn's spin alone — facingSystem does not step its yaw", () => {
    const world = createWorld();
    const pawn = makePawn(world, new Vector3(0, 0, 5));
    addTag(world, pawn, "aiming");

    resolve(world, pawn);
    timerSystem(world, PAWN_DEATH_DURATION / 4);
    const spun = world.rotations.get(pawn)!.yaw;

    const grid: Grid = {
      columns: 3,
      rows: 3,
      cellSize: 1,
      center: new Vector3(0, 0, 0),
      palette: ["koi", "tide"],
    };
    facingSystem(world, grid, PAWN_DEATH_DURATION / 4);

    expect(world.rotations.get(pawn)!.yaw).toBe(spun);
  });

  it("ignores a scale tween finishing on an entity that is not dying", () => {
    const world = createWorld();
    const entity = createEntity();

    world.events.push({ type: "scale-tween-complete", entity });
    deathSystem(world);

    expect(hasTag(world, entity, "destroy")).toBe(false);
  });

  it("does not restart the animation when a pawn is resolved twice", () => {
    const world = createWorld();
    const pawn = makePawn(world);

    resolve(world, pawn);
    timerSystem(world, PAWN_DEATH_DURATION / 2);
    resolve(world, pawn);

    expect(world.scaleTweens.get(pawn)!.elapsed).toBeCloseTo(
      PAWN_DEATH_DURATION / 2,
    );
  });

  it("does not throw for a resolved pawn with neither rotation nor position", () => {
    const world = createWorld();
    const bare = createEntity();

    world.events.push({ type: "pawn-resolved", entity: bare, depleted: false });
    expect(() => deathSystem(world)).not.toThrow();
    expect(world.scaleTweens.has(bare)).toBe(true);
  });
});

describe("deathSystem in the frame pipeline", () => {
  /**
   * The regression the deferred teardown invites: a depleted pawn used to be
   * garbage-collected on the frame it fired its last round, so `depleteAmmo`
   * never saw it again. It now lives on for PAWN_DEATH_DURATION, and without
   * the "dying" gate `shootingSystem` would resolve it — and `lifeSystem`
   * refund a life — on every one of those frames.
   */
  it("refunds exactly one life for a depleted pawn, across the whole animation", () => {
    const world = createWorld();
    const grid: Grid = {
      columns: 3,
      rows: 3,
      cellSize: 1,
      center: new Vector3(0, 0, 0),
      palette: ["koi", "tide"],
    };
    const ctx: SystemContext = { scene: new Scene(), pathEntity: createEntity() };

    for (let column = 0; column < 3; column++) {
      spawnBlock(world, {
        flag: "light",
        palette: "koi",
        row: 0,
        column,
        totalColumns: 3,
        position: new Vector3(column - 1, 0, -1),
      });
    }

    const pawn = makePawn(world, new Vector3(0, 0, -2));
    world.flags.set(pawn, "light");
    world.ammo.set(pawn, 1);
    world.pathFollowers.set(pawn, PathFollower(ctx.pathEntity, 0));

    const startingLifes = world.lifes;
    let resolvedEvents = 0;

    // A frame's worth of the systems that matter here, in schedule order.
    const dt = PAWN_DEATH_DURATION / 10;
    for (let frame = 0; frame < 30; frame++) {
      shootingSystem(world, grid, ctx);
      timerSystem(world, dt);
      deathSystem(world);
      lifeSystem(world);
      facingSystem(world, grid, dt);
      garbageCollectionSystem(world, ctx);
      resolvedEvents += world.events.filter(
        (event) => event.type === "pawn-resolved",
      ).length;
      clearEventsSystem(world);
    }

    expect(resolvedEvents).toBe(1);
    expect(world.lifes).toBe(startingLifes + 1);
    // And it really is gone by the end, components and all.
    expect(world.positions.has(pawn)).toBe(false);
    expect(world.scales.has(pawn)).toBe(false);
    expect(world.scaleTweens.has(pawn)).toBe(false);
    expect(world.rotationTweens.has(pawn)).toBe(false);
    expect(hasTag(world, pawn, "dying")).toBe(false);
  });
});
