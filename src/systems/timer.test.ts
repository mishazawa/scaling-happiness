import { describe, it, expect } from "vitest";
import { Vector3 } from "three";
import { createWorld } from "../core/World";
import { createEntity } from "../core/Entity";
import { PositionTween, ScalarTween } from "../core/Tween";
import { Rotation } from "../core/Rotation";
import { Countdown } from "../core/Countdown";
import { readEvents } from "../core/Event";
import { timerSystem } from "./timer";

describe("timerSystem", () => {
  it("advances a position tween and writes the interpolated position", () => {
    const world = createWorld();
    const entity = createEntity();
    world.positions.set(entity, new Vector3(0, 0, 0));
    world.positionTweens.set(
      entity,
      PositionTween(new Vector3(0, 0, 0), new Vector3(10, 0, 0), 2),
    );

    timerSystem(world, 1);

    expect(world.positions.get(entity)).toEqual(new Vector3(5, 0, 0));
    expect(world.positionTweens.has(entity)).toBe(true);
    expect(readEvents(world, "position-tween-complete")).toEqual([]);
  });

  it("completes a tween exactly once: removes it and emits position-tween-complete", () => {
    const world = createWorld();
    const entity = createEntity();
    world.positions.set(entity, new Vector3(0, 0, 0));
    world.positionTweens.set(
      entity,
      PositionTween(new Vector3(0, 0, 0), new Vector3(10, 0, 0), 1),
    );

    timerSystem(world, 1);

    expect(world.positions.get(entity)).toEqual(new Vector3(10, 0, 0));
    expect(world.positionTweens.has(entity)).toBe(false);
    expect(readEvents(world, "position-tween-complete")).toEqual([
      { type: "position-tween-complete", entity },
    ]);

    world.events = [];
    timerSystem(world, 1);
    expect(readEvents(world, "position-tween-complete")).toEqual([]);
  });

  it("does not overshoot past the end point when dt overshoots the duration", () => {
    const world = createWorld();
    const entity = createEntity();
    world.positions.set(entity, new Vector3(0, 0, 0));
    world.positionTweens.set(
      entity,
      PositionTween(new Vector3(0, 0, 0), new Vector3(10, 0, 0), 1),
    );

    timerSystem(world, 100);

    expect(world.positions.get(entity)).toEqual(new Vector3(10, 0, 0));
  });

  it("advances a scale tween and writes the interpolated scale", () => {
    const world = createWorld();
    const entity = createEntity();
    world.scaleTweens.set(entity, ScalarTween(1, 0, 2));

    timerSystem(world, 1);

    expect(world.scales.get(entity)).toBeCloseTo(0.5);
    expect(world.scaleTweens.has(entity)).toBe(true);
    expect(readEvents(world, "scale-tween-complete")).toEqual([]);
  });

  it("completes a scale tween exactly once: removes it and emits scale-tween-complete", () => {
    const world = createWorld();
    const entity = createEntity();
    world.scaleTweens.set(entity, ScalarTween(1, 0, 1));

    timerSystem(world, 1);

    expect(world.scales.get(entity)).toBe(0);
    expect(world.scaleTweens.has(entity)).toBe(false);
    expect(readEvents(world, "scale-tween-complete")).toEqual([
      { type: "scale-tween-complete", entity },
    ]);

    world.events = [];
    timerSystem(world, 1);
    expect(readEvents(world, "scale-tween-complete")).toEqual([]);
  });

  it("advances a rotation tween straight onto the entity's yaw", () => {
    const world = createWorld();
    const entity = createEntity();
    world.rotations.set(entity, Rotation(0));
    world.rotationTweens.set(entity, ScalarTween(0, 4, 2));

    timerSystem(world, 1);

    expect(world.rotations.get(entity)!.yaw).toBeCloseTo(2);
    expect(world.rotationTweens.has(entity)).toBe(true);
  });

  it("expires a rotation tween silently — no event keys off a yaw sweep ending", () => {
    const world = createWorld();
    const entity = createEntity();
    world.rotations.set(entity, Rotation(0));
    world.rotationTweens.set(entity, ScalarTween(0, 4, 1));

    timerSystem(world, 1);

    expect(world.rotations.get(entity)!.yaw).toBe(4);
    expect(world.rotationTweens.has(entity)).toBe(false);
    expect(world.events).toEqual([]);
  });

  it("does not throw when a rotation tween's entity has no rotation component", () => {
    const world = createWorld();
    const entity = createEntity();
    world.rotationTweens.set(entity, ScalarTween(0, 4, 1));

    expect(() => timerSystem(world, 1)).not.toThrow();
  });

  it("expires a countdown by deleting it, without emitting any event", () => {
    const world = createWorld();
    const key = createEntity();
    world.countdowns.set(key, Countdown(1));

    timerSystem(world, 1);

    expect(world.countdowns.has(key)).toBe(false);
    expect(world.events).toEqual([]);
  });

  it("leaves an unexpired countdown in place, with accumulated elapsed", () => {
    const world = createWorld();
    const key = createEntity();
    world.countdowns.set(key, Countdown(2));

    timerSystem(world, 1);

    expect(world.countdowns.get(key)).toEqual({ elapsed: 1, duration: 2 });
  });
});
