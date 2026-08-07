import { describe, it, expect } from "vitest";
import { Mesh, Scene, Vector3 } from "three";
import { createWorld } from "../core/World";
import { createEntity } from "../core/Entity";
import { addTag, hasTag } from "../core/Tag";
import { PathFollower } from "../core/Path";
import { PositionTween } from "../core/Tween";
import { spawnPawn } from "../setup/pawn";
import { spawnBlock } from "../setup/block";
import { spawnQueue, addPawnToQueue } from "../setup/queue";
import { getQueueId } from "../core/Queue";
import { addRenderable } from "../render/renderable";
import { garbageCollectionSystem } from "./garbageCollection";
import type { SystemContext } from "./context";

describe("garbageCollectionSystem", () => {
  it("removes a destroy-tagged entity's mesh from the scene and renderables", () => {
    const world = createWorld();
    const scene = new Scene();
    const ctx: SystemContext = { scene, pathEntity: createEntity() };

    // Pawns and blocks are instanced now; a queue's invisible pick box is the
    // remaining kind of entity that owns an Object3D.
    const entity = createEntity();
    const mesh = new Mesh();
    addRenderable(world, scene, entity, mesh);
    expect(scene.children).toContain(mesh);

    addTag(world, entity, "destroy");
    garbageCollectionSystem(world, ctx);

    expect(scene.children).not.toContain(mesh);
    expect(world.renderables.has(entity)).toBe(false);
  });

  it("clears the model component of a destroyed instanced entity", () => {
    // Pawns have no Object3D at all — the render system repacks instance slots
    // from world.models every frame, so a stale entry keeps a dead pawn drawn.
    const world = createWorld();
    const scene = new Scene();
    const ctx: SystemContext = { scene, pathEntity: createEntity() };

    const pawn = spawnPawn(world, {
      flag: "light",
      palette: "koi",
      position: new Vector3(),
    });
    expect(world.models.has(pawn)).toBe(true);

    addTag(world, pawn, "destroy");
    garbageCollectionSystem(world, ctx);

    expect(world.models.has(pawn)).toBe(false);
  });

  it("deletes the entity from positions, flags, pathFollowers, ammo, and tags", () => {
    const world = createWorld();
    const scene = new Scene();
    const ctx: SystemContext = { scene, pathEntity: createEntity() };

    const pawn = spawnPawn(world, {
      flag: "dark",
      palette: "tide",
      position: new Vector3(1, 2, 3),
    });
    const pathEntity = createEntity();
    world.pathFollowers.set(pawn, PathFollower(pathEntity, 1));
    world.positionTweens.set(
      pawn,
      PositionTween(new Vector3(), new Vector3(1, 0, 0), 1, "linear"),
    );
    expect(world.ammo.has(pawn)).toBe(true);

    addTag(world, pawn, "destroy");
    garbageCollectionSystem(world, ctx);

    expect(world.positions.has(pawn)).toBe(false);
    expect(world.flags.has(pawn)).toBe(false);
    expect(world.pathFollowers.has(pawn)).toBe(false);
    expect(world.ammo.has(pawn)).toBe(false);
    expect(world.positionTweens.has(pawn)).toBe(false);
    expect(hasTag(world, pawn, "pawn")).toBe(false);
    expect(hasTag(world, pawn, "destroy")).toBe(false);
  });

  it("deletes a destroyed projectile's target cell", () => {
    const world = createWorld();
    const scene = new Scene();
    const ctx: SystemContext = { scene, pathEntity: createEntity() };

    const projectile = createEntity();
    addTag(world, projectile, "projectile");
    world.projectileTargets.set(projectile, 7);

    addTag(world, projectile, "destroy");
    garbageCollectionSystem(world, ctx);

    expect(world.projectileTargets.has(projectile)).toBe(false);
  });

  it("clears a destroyed block's grid slot", () => {
    const world = createWorld();
    const scene = new Scene();
    const ctx: SystemContext = { scene, pathEntity: createEntity() };

    const block = spawnBlock(world, {
      flag: "light",
      palette: "koi",
      row: 1,
      column: 2,
      totalColumns: 5,
      position: new Vector3(),
    });
    expect(world.gridToEntity.size).toBe(1);

    addTag(world, block, "destroy");
    garbageCollectionSystem(world, ctx);

    expect(world.gridToEntity.size).toBe(0);
    expect(world.blocks.has(block)).toBe(false);
  });

  it("removes a still-queued pawn from its queue's member array and membership index", () => {
    const world = createWorld();
    const scene = new Scene();
    const ctx: SystemContext = { scene, pathEntity: createEntity() };

    const queueId = spawnQueue(world, scene, new Vector3());
    const pawn = spawnPawn(world, {
      flag: "light",
      palette: "koi",
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
    const ctx: SystemContext = {
      scene: new Scene(),
      pathEntity: createEntity(),
    };

    expect(() => garbageCollectionSystem(world, ctx)).not.toThrow();
  });
});
