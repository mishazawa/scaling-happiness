import { describe, it, expect } from "vitest";
import { Scene, Vector3 } from "three";
import { createWorld } from "../core/World";
import { createEntity } from "../core/Entity";
import { addTag, hasTag } from "../core/Tag";
import { pushEvent } from "../core/Event";
import { spawnBlock } from "../setup/block";
import { toFlat } from "../utils";
import { destructionSystem } from "./destruction";

describe("destructionSystem", () => {
  it("destroys the projectile and the block at its target cell once the tween completes", () => {
    const world = createWorld();
    const block = spawnBlock(
      world,
      new Scene(),
      "#FFF",
      0,
      1,
      3,
      new Vector3(0, 0, -1),
    );
    addTag(world, block, "targeted");

    const projectile = createEntity();
    addTag(world, projectile, "projectile");
    world.projectileTargets.set(projectile, toFlat(0, 1, 3));
    pushEvent(world, { type: "position-tween-complete", entity: projectile });

    destructionSystem(world);

    expect(hasTag(world, projectile, "destroy")).toBe(true);
    expect(hasTag(world, block, "destroy")).toBe(true);
  });

  it("ignores position-tween-complete events for non-projectile entities", () => {
    const world = createWorld();
    const entity = createEntity();
    pushEvent(world, { type: "position-tween-complete", entity });

    expect(() => destructionSystem(world)).not.toThrow();
    expect(hasTag(world, entity, "destroy")).toBe(false);
  });

  it("still destroys the projectile when its target cell is already empty", () => {
    const world = createWorld();
    const projectile = createEntity();
    addTag(world, projectile, "projectile");
    world.projectileTargets.set(projectile, 42);
    pushEvent(world, { type: "position-tween-complete", entity: projectile });

    destructionSystem(world);

    expect(hasTag(world, projectile, "destroy")).toBe(true);
  });
});
