import { describe, it, expect } from "vitest";
import { createWorld } from "../core/World";
import { createEntity } from "../core/Entity";
import { pushEvent, readEvents } from "../core/Event";
import { LIFES_COUNT } from "../constants";
import { lifeSystem } from "./life";

describe("lifeSystem", () => {
  it("decrements lifes once per pawn-spawned event", () => {
    const world = createWorld();
    pushEvent(world, { type: "pawn-spawned", entity: createEntity() });
    pushEvent(world, { type: "pawn-spawned", entity: createEntity() });

    lifeSystem(world);

    expect(world.lifes).toBe(LIFES_COUNT - 2);
  });

  it("increments lifes on pawn-resolved when depleted", () => {
    const world = createWorld();
    pushEvent(world, {
      type: "pawn-resolved",
      entity: createEntity(),
      depleted: true,
    });

    lifeSystem(world);

    expect(world.lifes).toBe(LIFES_COUNT + 1);
  });

  it("ignores pawn-resolved when not depleted", () => {
    const world = createWorld();
    pushEvent(world, {
      type: "pawn-resolved",
      entity: createEntity(),
      depleted: false,
    });

    lifeSystem(world);

    expect(world.lifes).toBe(LIFES_COUNT);
  });

  it("clamps at zero instead of going negative", () => {
    const world = createWorld();
    world.lifes = 0;
    pushEvent(world, { type: "pawn-spawned", entity: createEntity() });

    lifeSystem(world);

    expect(world.lifes).toBe(0);
  });

  it("does not remove events it reads", () => {
    const world = createWorld();
    const entity = createEntity();
    pushEvent(world, { type: "pawn-spawned", entity });

    lifeSystem(world);

    // Asserted as the event still being there, not as the array's length: the
    // system appends one of its own, and consumers never remove.
    expect(readEvents(world, "pawn-spawned")).toEqual([
      { type: "pawn-spawned", entity },
    ]);
  });

  it("announces the change as one life-changed event", () => {
    const world = createWorld();
    pushEvent(world, { type: "pawn-spawned", entity: createEntity() });
    pushEvent(world, { type: "pawn-spawned", entity: createEntity() });

    lifeSystem(world);

    expect(readEvents(world, "life-changed")).toEqual([
      { type: "life-changed", delta: -2 },
    ]);
  });

  it("announces the refund's sign", () => {
    const world = createWorld();
    pushEvent(world, {
      type: "pawn-resolved",
      entity: createEntity(),
      depleted: true,
    });

    lifeSystem(world);

    expect(readEvents(world, "life-changed")[0].delta).toBe(1);
  });

  /**
   * The clamp is why the event carries the applied delta rather than the asked
   * one: spending the last life twice in a frame only costs a life once, and
   * anything showing the count has to agree with the count.
   */
  it("announces what it applied, not what it was asked for", () => {
    const world = createWorld();
    world.lifes = 1;
    pushEvent(world, { type: "pawn-spawned", entity: createEntity() });
    pushEvent(world, { type: "pawn-spawned", entity: createEntity() });

    lifeSystem(world);

    expect(world.lifes).toBe(0);
    expect(readEvents(world, "life-changed")[0].delta).toBe(-1);
  });

  it("says nothing when the count did not move", () => {
    const world = createWorld();
    world.lifes = 0;
    pushEvent(world, { type: "pawn-spawned", entity: createEntity() });

    lifeSystem(world);

    expect(readEvents(world, "life-changed")).toEqual([]);
  });

  it("says nothing when a spend and a refund cancel out", () => {
    const world = createWorld();
    pushEvent(world, { type: "pawn-spawned", entity: createEntity() });
    pushEvent(world, {
      type: "pawn-resolved",
      entity: createEntity(),
      depleted: true,
    });

    lifeSystem(world);

    expect(world.lifes).toBe(LIFES_COUNT);
    expect(readEvents(world, "life-changed")).toEqual([]);
  });
});
