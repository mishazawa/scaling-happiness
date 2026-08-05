import { describe, it, expect } from "vitest";
import { Scene, Vector3 } from "three";
import { createWorld } from "../core/World";
import { hasTag } from "../core/Tag";
import { getQueueId } from "../core/Queue";
import { QUEUE_DIRECTION, QUEUE_SPACING } from "../constants";
import { spawnPawn } from "./pawn";
import { addPawnToQueue, releasePawnFromQueue, spawnQueue } from "./queue";

describe("queue", () => {
  it("tags added pawns as queued and lines them up behind the queue position", () => {
    const world = createWorld();
    const scene = new Scene();
    const base = new Vector3(0, 0, 0);
    const queueId = spawnQueue(world, base);

    const a = spawnPawn(world, scene, { color: "#FFF", position: base });
    const b = spawnPawn(world, scene, { color: "#FFF", position: base });

    addPawnToQueue(world, queueId, a);
    addPawnToQueue(world, queueId, b);

    expect(hasTag(world, a, "queued")).toBe(true);
    expect(hasTag(world, b, "queued")).toBe(true);
    expect(getQueueId(world, a)).toBe(queueId);
    expect(getQueueId(world, b)).toBe(queueId);

    const expectedA = base
      .clone()
      .addScaledVector(new Vector3(...QUEUE_DIRECTION), QUEUE_SPACING * 0);
    const expectedB = base
      .clone()
      .addScaledVector(new Vector3(...QUEUE_DIRECTION), QUEUE_SPACING * 1);

    expect(world.positions.get(a)).toEqual(expectedA);
    expect(world.positions.get(b)).toEqual(expectedB);
  });

  it("releases the front pawn in FIFO order, untags it, and shifts the rest forward", () => {
    const world = createWorld();
    const scene = new Scene();
    const base = new Vector3(0, 0, 0);
    const queueId = spawnQueue(world, base);

    const a = spawnPawn(world, scene, { color: "#FFF", position: base });
    const b = spawnPawn(world, scene, { color: "#FFF", position: base });
    addPawnToQueue(world, queueId, a);
    addPawnToQueue(world, queueId, b);

    const released = releasePawnFromQueue(world, queueId);

    expect(released).toBe(a);
    expect(hasTag(world, a, "queued")).toBe(false);
    expect(getQueueId(world, a)).toBeUndefined();

    const expectedB = base
      .clone()
      .addScaledVector(new Vector3(...QUEUE_DIRECTION), QUEUE_SPACING * 0);
    expect(world.positions.get(b)).toEqual(expectedB);
  });

  it("returns undefined when releasing from an empty queue", () => {
    const world = createWorld();
    const queueId = spawnQueue(world, new Vector3());

    expect(releasePawnFromQueue(world, queueId)).toBeUndefined();
  });
});
