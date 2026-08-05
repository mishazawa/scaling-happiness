import { describe, it, expect } from "vitest";
import { Vector3 } from "three";
import { createWorld } from "../core/World";
import { createEntity } from "../core/Entity";
import { PositionTween } from "../core/Tween";
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
