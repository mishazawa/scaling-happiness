import { describe, it, expect } from "vitest";
import { Scene, Vector3 } from "three";
import { createWorld } from "../core/World";
import { createEntity } from "../core/Entity";
import { Path } from "../core/Path";
import { pushEvent, readEvents } from "../core/Event";
import { hasTag } from "../core/Tag";
import { spawnQueue, addPawnToQueue } from "../setup/queue";
import { spawnPawn } from "../setup/pawn";
import { spawnSystem } from "./spawn";
import { timerSystem } from "./timer";
import type { SystemContext } from "./context";
import { SPAWN_TRANSIT_DURATION } from "../constants";

function setupPath(
  world: ReturnType<typeof createWorld>,
): SystemContext["pathEntity"] {
  const pathEntity = createEntity();
  world.paths.set(
    pathEntity,
    Path([new Vector3(0, 0, 0), new Vector3(1, 0, 0)]),
  );
  return pathEntity;
}

describe("spawnSystem", () => {
  it("on click: starts a queue->track tween instead of releasing onto the path immediately", () => {
    const world = createWorld();
    const scene = new Scene();
    const pathEntity = setupPath(world);
    const ctx: SystemContext = { scene, pathEntity };

    const queueId = spawnQueue(world, scene, new Vector3());
    const pawn = spawnPawn(world, {
      color: "#FFF",
      position: new Vector3(),
    });
    addPawnToQueue(world, queueId, pawn);

    pushEvent(world, { type: "queue-clicked", queue: queueId });
    spawnSystem(world, ctx);

    expect(hasTag(world, pawn, "queued")).toBe(false);
    expect(hasTag(world, pawn, "spawning")).toBe(true);
    expect(world.positionTweens.has(pawn)).toBe(true);
    expect(world.pathFollowers.has(pawn)).toBe(false);
    expect(readEvents(world, "pawn-spawned")).toEqual([]);
    expect(world.queues.get(queueId)?.length).toBe(1); // replenished
    expect(world.countdowns.has(queueId)).toBe(true);
  });

  it("finalizes onto the path once the tween completes", () => {
    const world = createWorld();
    const scene = new Scene();
    const pathEntity = setupPath(world);
    const ctx: SystemContext = { scene, pathEntity };

    const queueId = spawnQueue(world, scene, new Vector3());
    const pawn = spawnPawn(world, {
      color: "#FFF",
      position: new Vector3(),
    });
    addPawnToQueue(world, queueId, pawn);

    pushEvent(world, { type: "queue-clicked", queue: queueId });
    spawnSystem(world, ctx);

    world.events = [];
    timerSystem(world, SPAWN_TRANSIT_DURATION);
    spawnSystem(world, ctx);

    expect(hasTag(world, pawn, "spawning")).toBe(false);
    expect(world.pathFollowers.get(pawn)?.pathId).toBe(pathEntity);
    expect(readEvents(world, "pawn-spawned")).toEqual([
      { type: "pawn-spawned", entity: pawn },
    ]);
  });

  it("ignores a second click on the same queue during its cooldown", () => {
    const world = createWorld();
    const scene = new Scene();
    const pathEntity = setupPath(world);
    const ctx: SystemContext = { scene, pathEntity };

    const queueId = spawnQueue(world, scene, new Vector3());
    const pawnA = spawnPawn(world, {
      color: "#FFF",
      position: new Vector3(),
    });
    const pawnB = spawnPawn(world, {
      color: "#FFF",
      position: new Vector3(),
    });
    addPawnToQueue(world, queueId, pawnA);
    addPawnToQueue(world, queueId, pawnB);

    pushEvent(world, { type: "queue-clicked", queue: queueId });
    spawnSystem(world, ctx);
    const queueLengthAfterFirstClick = world.queues.get(queueId)?.length;

    world.events = [];
    pushEvent(world, { type: "queue-clicked", queue: queueId });
    spawnSystem(world, ctx);

    expect(world.queues.get(queueId)?.length).toBe(queueLengthAfterFirstClick);
    expect(hasTag(world, pawnB, "spawning")).toBe(false);
  });

  it("skips (not drops the batch) when the clicked queue is already empty", () => {
    const world = createWorld();
    const scene = new Scene();
    const pathEntity = setupPath(world);
    const ctx: SystemContext = { scene, pathEntity };

    const emptyQueue = spawnQueue(world, scene, new Vector3());
    const queueId = spawnQueue(world, scene, new Vector3(1, 0, 0));
    const pawn = spawnPawn(world, {
      color: "#FFF",
      position: new Vector3(),
    });
    addPawnToQueue(world, queueId, pawn);

    pushEvent(world, { type: "queue-clicked", queue: emptyQueue });
    pushEvent(world, { type: "queue-clicked", queue: queueId });
    spawnSystem(world, ctx);

    expect(hasTag(world, pawn, "spawning")).toBe(true);
  });

  it("releases at most `lifes` pawns across a batch of queue-clicked events", () => {
    const world = createWorld();
    const scene = new Scene();
    const pathEntity = setupPath(world);
    const ctx: SystemContext = { scene, pathEntity };
    world.lifes = 1;

    const queueA = spawnQueue(world, scene, new Vector3());
    const queueB = spawnQueue(world, scene, new Vector3(1, 0, 0));
    const pawnA = spawnPawn(world, {
      color: "#FFF",
      position: new Vector3(),
    });
    const pawnB = spawnPawn(world, {
      color: "#FFF",
      position: new Vector3(),
    });
    addPawnToQueue(world, queueA, pawnA);
    addPawnToQueue(world, queueB, pawnB);

    pushEvent(world, { type: "queue-clicked", queue: queueA });
    pushEvent(world, { type: "queue-clicked", queue: queueB });
    spawnSystem(world, ctx);

    expect(hasTag(world, pawnA, "spawning")).toBe(true);
    expect(hasTag(world, pawnB, "queued")).toBe(true);
    expect(world.positionTweens.has(pawnB)).toBe(false);
  });

  it("releases nothing when lifes is 0", () => {
    const world = createWorld();
    const scene = new Scene();
    const pathEntity = setupPath(world);
    const ctx: SystemContext = { scene, pathEntity };
    world.lifes = 0;

    const queueId = spawnQueue(world, scene, new Vector3());
    const pawn = spawnPawn(world, {
      color: "#FFF",
      position: new Vector3(),
    });
    addPawnToQueue(world, queueId, pawn);

    pushEvent(world, { type: "queue-clicked", queue: queueId });
    spawnSystem(world, ctx);

    expect(readEvents(world, "pawn-spawned")).toEqual([]);
    expect(hasTag(world, pawn, "queued")).toBe(true);
  });

  it("counts in-flight (spawning) pawns against the lifes budget", () => {
    const world = createWorld();
    const scene = new Scene();
    const pathEntity = setupPath(world);
    const ctx: SystemContext = { scene, pathEntity };
    world.lifes = 1;

    const queueA = spawnQueue(world, scene, new Vector3());
    const queueB = spawnQueue(world, scene, new Vector3(1, 0, 0));
    const pawnA = spawnPawn(world, {
      color: "#FFF",
      position: new Vector3(),
    });
    const pawnB = spawnPawn(world, {
      color: "#FFF",
      position: new Vector3(),
    });
    addPawnToQueue(world, queueA, pawnA);
    addPawnToQueue(world, queueB, pawnB);

    pushEvent(world, { type: "queue-clicked", queue: queueA });
    spawnSystem(world, ctx);
    expect(hasTag(world, pawnA, "spawning")).toBe(true); // in flight, no pawn-spawned yet

    world.events = [];
    pushEvent(world, { type: "queue-clicked", queue: queueB });
    spawnSystem(world, ctx);

    expect(hasTag(world, pawnB, "queued")).toBe(true);
    expect(world.positionTweens.has(pawnB)).toBe(false);
  });
});
