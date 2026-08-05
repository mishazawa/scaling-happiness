import { describe, it, expect } from "vitest";
import { Scene, Vector3 } from "three";
import { createWorld } from "../core/World";
import { createEntity } from "../core/Entity";
import { pushEvent, readEvents } from "../core/Event";
import { hasTag } from "../core/Tag";
import { spawnQueue, addPawnToQueue } from "../setup/queue";
import { spawnPawn } from "../setup/pawn";
import { spawnSystem } from "./spawn";
import type { SystemContext } from "./context";

describe("spawnSystem", () => {
  it("releases a queued pawn onto the path and emits pawn-spawned", () => {
    const world = createWorld();
    const scene = new Scene();
    const pathEntity = createEntity();
    const ctx: SystemContext = { scene, pathEntity };

    const queueId = spawnQueue(world, new Vector3());
    const pawn = spawnPawn(world, scene, {
      color: "#FFF",
      position: new Vector3(),
    });
    addPawnToQueue(world, queueId, pawn);

    pushEvent(world, { type: "queue-clicked", queue: queueId });
    spawnSystem(world, ctx);

    expect(hasTag(world, pawn, "queued")).toBe(false);
    expect(world.pathFollowers.get(pawn)?.pathId).toBe(pathEntity);
    expect(world.queues.get(queueId)?.length).toBe(1); // replenished
    expect(readEvents(world, "pawn-spawned")).toEqual([
      { type: "pawn-spawned", entity: pawn },
    ]);
  });

  it("skips (not drops the batch) when the clicked queue is already empty", () => {
    const world = createWorld();
    const scene = new Scene();
    const ctx: SystemContext = { scene, pathEntity: createEntity() };

    const emptyQueue = spawnQueue(world, new Vector3());
    const queueId = spawnQueue(world, new Vector3(1, 0, 0));
    const pawn = spawnPawn(world, scene, {
      color: "#FFF",
      position: new Vector3(),
    });
    addPawnToQueue(world, queueId, pawn);

    pushEvent(world, { type: "queue-clicked", queue: emptyQueue });
    pushEvent(world, { type: "queue-clicked", queue: queueId });
    spawnSystem(world, ctx);

    expect(readEvents(world, "pawn-spawned")).toEqual([
      { type: "pawn-spawned", entity: pawn },
    ]);
  });
});
