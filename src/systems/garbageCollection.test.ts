import { describe, it, expect } from "vitest";
import { Scene, Vector3 } from "three";
import { createWorld } from "../core/World";
import { createEntity } from "../core/Entity";
import { addTag, hasTag } from "../core/Tag";
import { PathFollower } from "../core/Path";
import { spawnPawn } from "../setup/pawn";
import { spawnBlock } from "../setup/block";
import { spawnQueue, addPawnToQueue } from "../setup/queue";
import { getQueueId } from "../core/Queue";
import { garbageCollectionSystem } from "./garbageCollection";
import type { SystemContext } from "./context";

describe("garbageCollectionSystem", () => {
  it("removes a destroy-tagged entity's mesh from the scene and renderables", () => {
    const world = createWorld();
    const scene = new Scene();
    const ctx: SystemContext = { scene };

    const pawn = spawnPawn(world, scene, {
      color: "#FFF",
      position: new Vector3(),
    });
    const mesh = world.renderables.get(pawn);
    expect(scene.children).toContain(mesh);

    addTag(world, pawn, "destroy");
    garbageCollectionSystem(world, ctx);

    expect(scene.children).not.toContain(mesh);
    expect(world.renderables.has(pawn)).toBe(false);
  });

  it("deletes the entity from positions, colors, pathFollowers, ammo, and tags", () => {
    const world = createWorld();
    const scene = new Scene();
    const ctx: SystemContext = { scene };

    const pawn = spawnPawn(world, scene, {
      color: "#000",
      position: new Vector3(1, 2, 3),
    });
    const pathEntity = createEntity();
    world.pathFollowers.set(pawn, PathFollower(pathEntity, 1));
    expect(world.ammo.has(pawn)).toBe(true);

    addTag(world, pawn, "destroy");
    garbageCollectionSystem(world, ctx);

    expect(world.positions.has(pawn)).toBe(false);
    expect(world.colors.has(pawn)).toBe(false);
    expect(world.pathFollowers.has(pawn)).toBe(false);
    expect(world.ammo.has(pawn)).toBe(false);
    expect(hasTag(world, pawn, "pawn")).toBe(false);
    expect(hasTag(world, pawn, "destroy")).toBe(false);
  });

  it("clears a destroyed block's grid slot", () => {
    const world = createWorld();
    const scene = new Scene();
    const ctx: SystemContext = { scene };

    const block = spawnBlock(world, scene, "#FFF", 1, 2, 5, new Vector3());
    expect(world.gridToEntity.size).toBe(1);

    addTag(world, block, "destroy");
    garbageCollectionSystem(world, ctx);

    expect(world.gridToEntity.size).toBe(0);
    expect(world.blocks.has(block)).toBe(false);
  });

  it("removes a still-queued pawn from its queue's member array and membership index", () => {
    const world = createWorld();
    const scene = new Scene();
    const ctx: SystemContext = { scene };

    const queueId = spawnQueue(world, new Vector3());
    const pawn = spawnPawn(world, scene, {
      color: "#FFF",
      position: new Vector3(),
    });
    addPawnToQueue(world, queueId, pawn);
    expect(world.queues.get(queueId)).toEqual([pawn]);

    addTag(world, pawn, "destroy");
    garbageCollectionSystem(world, ctx);

    expect(world.queues.get(queueId)).toEqual([]);
    expect(getQueueId(world, pawn)).toBeUndefined();
  });

  it("is a no-op when there are no destroy-tagged entities", () => {
    const world = createWorld();
    const ctx: SystemContext = { scene: new Scene() };

    expect(() => garbageCollectionSystem(world, ctx)).not.toThrow();
  });
});
