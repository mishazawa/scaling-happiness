import { describe, it, expect } from "vitest";
import { createWorld } from "../core/World";
import { createEntity } from "../core/Entity";
import { pushEvent } from "../core/Event";
import { clearEventsSystem } from "./clearEvents";

describe("clearEventsSystem", () => {
  it("empties world.events", () => {
    const world = createWorld();
    pushEvent(world, { type: "pawn-spawned", entity: createEntity() });

    clearEventsSystem(world);

    expect(world.events).toEqual([]);
  });

  it("is a no-op when already empty", () => {
    const world = createWorld();

    expect(() => clearEventsSystem(world)).not.toThrow();
    expect(world.events).toEqual([]);
  });
});
