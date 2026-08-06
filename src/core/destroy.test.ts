import { describe, it, expect } from "vitest";
import { createWorld } from "./World";
import { createEntity } from "./Entity";
import { hasTag } from "./Tag";
import { markDestroyed } from "./destroy";

describe("markDestroyed", () => {
  it("tags the entity as destroy", () => {
    const world = createWorld();
    const entity = createEntity();

    markDestroyed(world, entity);

    expect(hasTag(world, entity, "destroy")).toBe(true);
  });
});
