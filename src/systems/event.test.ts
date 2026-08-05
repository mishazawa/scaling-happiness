import { describe, it, expect } from "vitest";
import { Scene } from "three";
import { createWorld } from "../core/World";
import { createEntity } from "../core/Entity";
import { pushEvent } from "../core/Event";
import { hasTag } from "../core/Tag";
import { eventSystem } from "./event";
import type { SystemContext } from "./context";

describe("eventSystem", () => {
  it("drains the queue and tags the target entity on entity-destroy", () => {
    const world = createWorld();
    const ctx: SystemContext = { scene: new Scene() };
    const entity = createEntity();

    pushEvent(world, { type: "entity-destroy", entity });
    eventSystem(world, ctx);

    expect(world.events).toEqual([]);
    expect(hasTag(world, entity, "destroy")).toBe(true);
  });

  it("does not process events pushed by a handler during the same drain", () => {
    const world = createWorld();
    const ctx: SystemContext = { scene: new Scene() };
    const a = createEntity();
    const b = createEntity();

    pushEvent(world, { type: "entity-destroy", entity: a });
    eventSystem(world, ctx);
    expect(hasTag(world, a, "destroy")).toBe(true);
    expect(hasTag(world, b, "destroy")).toBe(false);

    // Simulate a handler pushing a new event mid-frame: it must wait for the
    // next drain, not be picked up retroactively by the call that already ran.
    pushEvent(world, { type: "entity-destroy", entity: b });
    expect(hasTag(world, b, "destroy")).toBe(false);

    eventSystem(world, ctx);
    expect(hasTag(world, b, "destroy")).toBe(true);
  });

  it("is a no-op when the queue is empty", () => {
    const world = createWorld();
    const ctx: SystemContext = { scene: new Scene() };

    expect(() => eventSystem(world, ctx)).not.toThrow();
    expect(world.events).toEqual([]);
  });
});
