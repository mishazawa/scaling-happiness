import { describe, expect, it } from "vitest";
import { Scene, Vector3 } from "three";
import {
  LIFE_PEARL_DURATION,
  LIFE_PEARL_SCALE,
  PEARL_POSITION,
} from "../constants";
import { createEntity } from "../core/Entity";
import { pushEvent } from "../core/Event";
import { addTag, getEntitiesByTag, hasTag } from "../core/Tag";
import { createWorld, type World } from "../core/World";
import { garbageCollectionSystem } from "./garbageCollection";
import { lifePearlSystem } from "./lifePearl";
import { timerSystem } from "./timer";
import type { SystemContext } from "./context";

/** Where the standing pearl is, and so where these come from and go back to. */
const ANCHOR = new Vector3(...PEARL_POSITION);

function setup() {
  const world = createWorld();
  const scene = new Scene();
  const ctx: SystemContext = { scene, pathEntity: createEntity() };

  return { world, scene, ctx };
}

function pearls(world: World) {
  return Array.from(getEntitiesByTag(world, "life-pearl"));
}

describe("lifePearlSystem", () => {
  it("throws a pearl off the standing one when a life is spent", () => {
    const { world, ctx } = setup();
    pushEvent(world, { type: "life-changed", delta: -1 });

    lifePearlSystem(world, ctx);

    const [pearl] = pearls(world);
    expect(pearl).toBeDefined();
    expect(world.positions.get(pearl)!.y).toBe(ANCHOR.y);
    expect(world.scales.get(pearl)).toBe(LIFE_PEARL_SCALE);
  });

  it("drops one back in when a life is refunded", () => {
    const { world, ctx } = setup();
    pushEvent(world, { type: "life-changed", delta: 1 });

    lifePearlSystem(world, ctx);

    const [pearl] = pearls(world);
    // Starts above the standing pearl and at nothing — the spend, backwards.
    expect(world.positions.get(pearl)!.y).toBeGreaterThan(ANCHOR.y);
    expect(world.scales.get(pearl)).toBe(0);
  });

  /**
   * The standing pearl reads as the place lifes come from, not as a tally of them, so
   * two lifes lost to one frame's clicks is still one thing happening.
   */
  it("shows one pearl however far the count moved", () => {
    const { world, ctx } = setup();
    pushEvent(world, { type: "life-changed", delta: -3 });

    lifePearlSystem(world, ctx);

    expect(pearls(world)).toHaveLength(1);
  });

  it("stays quiet on a frame the count did not move", () => {
    const { world, ctx } = setup();

    lifePearlSystem(world, ctx);

    expect(pearls(world)).toHaveLength(0);
  });

  it("tears a pearl down when its clock runs out", () => {
    const { world, ctx } = setup();
    pushEvent(world, { type: "life-changed", delta: -1 });
    lifePearlSystem(world, ctx);
    const [pearl] = pearls(world);

    world.events.length = 0;
    pushEvent(world, { type: "scale-tween-complete", entity: pearl });
    lifePearlSystem(world, ctx);

    expect(hasTag(world, pearl, "destroy")).toBe(true);
  });

  it("leaves a finished scale tween that is not one of its own alone", () => {
    // deathSystem shares the event; the tag is what splits the two.
    const { world, ctx } = setup();
    const pawn = createEntity();
    addTag(world, pawn, "pawn");
    pushEvent(world, { type: "scale-tween-complete", entity: pawn });

    lifePearlSystem(world, ctx);

    expect(hasTag(world, pawn, "destroy")).toBe(false);
  });

  /**
   * The whole life of a pearl, driven by the same systems in the same order
   * main.ts runs them: nothing of it should outlast the animation, in the world
   * or in the scene.
   */
  it("leaves nothing behind once the animation has played out", () => {
    const { world, scene, ctx } = setup();
    const before = scene.children.length;
    pushEvent(world, { type: "life-changed", delta: -1 });

    const dt = 1 / 60;
    for (let frame = 0; frame * dt <= LIFE_PEARL_DURATION + dt; frame++) {
      timerSystem(world, dt);
      lifePearlSystem(world, ctx);
      garbageCollectionSystem(world, ctx);
      world.events.length = 0;
    }

    expect(pearls(world)).toHaveLength(0);
    expect(world.positions.size).toBe(0);
    expect(world.renderables.size).toBe(0);
    expect(world.scaleTweens.size).toBe(0);
    expect(world.rotationTweens.size).toBe(0);
    expect(world.positionTweens.size).toBe(0);
    expect(scene.children.length).toBe(before);
  });

  it("rises as it shrinks, rather than jumping at the end", () => {
    const { world, ctx } = setup();
    pushEvent(world, { type: "life-changed", delta: -1 });
    lifePearlSystem(world, ctx);
    const [pearl] = pearls(world);

    timerSystem(world, LIFE_PEARL_DURATION / 2);

    expect(world.positions.get(pearl)!.y).toBeGreaterThan(ANCHOR.y);
    expect(world.scales.get(pearl)!).toBeLessThan(LIFE_PEARL_SCALE);
    expect(world.scales.get(pearl)!).toBeGreaterThan(0);
    expect(world.rotations.get(pearl)!.yaw).toBeGreaterThan(0);
  });
});
