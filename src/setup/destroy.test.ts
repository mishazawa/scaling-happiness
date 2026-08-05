import { describe, it, expect } from "vitest";
import { createWorld } from "../core/World";
import { createEntity } from "../core/Entity";
import { hasTag } from "../core/Tag";
import { markDestroyed } from "./destroy";

describe("markDestroyed", () => {
  it("tags the entity as destroy", () => {
    const world = createWorld();
    const entity = createEntity();

    markDestroyed(world, entity);

    expect(hasTag(world, entity, "destroy")).toBe(true);
  });
});
