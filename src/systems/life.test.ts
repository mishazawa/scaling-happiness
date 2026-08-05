import { describe, it, expect } from "vitest";
import { createWorld } from "../core/World";
import { createEntity } from "../core/Entity";
import { pushEvent } from "../core/Event";
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
    pushEvent(world, { type: "pawn-spawned", entity: createEntity() });

    lifeSystem(world);

    expect(world.events.length).toBe(1);
  });
});
