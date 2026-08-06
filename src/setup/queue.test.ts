import { describe, it, expect } from "vitest";
import { Scene, Vector3 } from "three";
import { createWorld } from "../core/World";
import { hasTag } from "../core/Tag";
import { getQueueId } from "../core/Queue";
import {
  QUEUE_ADVANCE_DURATION,
  QUEUE_DIRECTION,
  QUEUE_SPACING,
} from "../constants";
import { timerSystem } from "../systems/timer";
import { spawnPawn } from "./pawn";
import {
  addPawnToQueue,
  advanceQueue,
  releasePawnFromQueue,
  spawnQueue,
  spawnQueuedPawn,
} from "./queue";

describe("queue", () => {
  it("tags added pawns as queued and lines them up behind the queue position", () => {
    const world = createWorld();
    const scene = new Scene();
    const base = new Vector3(0, 0, 0);
    const queueId = spawnQueue(world, scene, base);

    const a = spawnPawn(world, {
      flag: "light",
      palette: "koi",
      position: base,
    });
    const b = spawnPawn(world, {
      flag: "light",
      palette: "koi",
      position: base,
    });

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

  it("releases the front pawn in FIFO order, untags it, and leaves the rest standing where they are", () => {
    const world = createWorld();
    const scene = new Scene();
    const base = new Vector3(0, 0, 0);
    const queueId = spawnQueue(world, scene, base);

    const a = spawnPawn(world, {
      flag: "light",
      palette: "koi",
      position: base,
    });
    const b = spawnPawn(world, {
      flag: "light",
      palette: "koi",
      position: base,
    });
    addPawnToQueue(world, queueId, a);
    addPawnToQueue(world, queueId, b);

    const released = releasePawnFromQueue(world, queueId);

    expect(released).toBe(a);
    expect(hasTag(world, a, "queued")).toBe(false);
    expect(getQueueId(world, a)).toBeUndefined();

    // Still in slot 1, not snapped up to slot 0: closing the gap is
    // advanceQueue's job, and it waits for the released pawn to reach the track.
    const unmovedB = base
      .clone()
      .addScaledVector(new Vector3(...QUEUE_DIRECTION), QUEUE_SPACING * 1);
    expect(world.positions.get(b)).toEqual(unmovedB);
    expect(world.positionTweens.has(b)).toBe(false);
  });

  it("returns undefined when releasing from an empty queue", () => {
    const world = createWorld();
    const queueId = spawnQueue(world, new Scene(), new Vector3());

    expect(releasePawnFromQueue(world, queueId)).toBeUndefined();
  });

  it("spawnQueuedPawn spawns a pawn at the queue's position and enqueues it", () => {
    const world = createWorld();
    const scene = new Scene();
    const base = new Vector3(1, 0, -3);
    const queueId = spawnQueue(world, scene, base);

    const pawn = spawnQueuedPawn(world, queueId);

    expect(world.positions.get(pawn)).toEqual(base);
    expect(hasTag(world, pawn, "queued")).toBe(true);
    expect(getQueueId(world, pawn)).toBe(queueId);
    expect(world.queues.get(queueId)).toEqual([pawn]);
  });

  it("replenishes the queue: releasing a pawn and advancing keeps the queue size stable", () => {
    const world = createWorld();
    const scene = new Scene();
    const queueId = spawnQueue(world, scene, new Vector3());

    spawnQueuedPawn(world, queueId);
    spawnQueuedPawn(world, queueId);
    spawnQueuedPawn(world, queueId);

    const released = releasePawnFromQueue(world, queueId);
    advanceQueue(world, queueId);

    expect(released).toBeDefined();
    expect(world.queues.get(queueId)?.length).toBe(3);
    expect(getQueueId(world, released!)).toBeUndefined();
  });
});

describe("advanceQueue", () => {
  const base = new Vector3(0, 0, 0);

  function slot(index: number) {
    return base
      .clone()
      .addScaledVector(new Vector3(...QUEUE_DIRECTION), QUEUE_SPACING * index);
  }

  /** A queue of `size` pawns, standing on slots 0..size-1. */
  function filledQueue(world: ReturnType<typeof createWorld>, size: number) {
    const queueId = spawnQueue(world, new Scene(), base);
    for (let i = 0; i < size; i++) spawnQueuedPawn(world, queueId);
    return queueId;
  }

  it("sends every remaining member toward the slot in front of it, over QUEUE_ADVANCE_DURATION", () => {
    const world = createWorld();
    const queueId = filledQueue(world, 3);
    releasePawnFromQueue(world, queueId);

    advanceQueue(world, queueId);

    const members = world.queues.get(queueId)!;
    members.forEach((member, index) => {
      const tween = world.positionTweens.get(member)!;
      expect(tween.duration).toBe(QUEUE_ADVANCE_DURATION);
      expect(tween.to).toEqual(slot(index));
    });
    // The two survivors start from where they stood, one slot back.
    expect(world.positionTweens.get(members[0])!.from).toEqual(slot(1));
    expect(world.positionTweens.get(members[1])!.from).toEqual(slot(2));
  });

  it("spawns the replacement a slot behind its place, so it slides in with the rest", () => {
    const world = createWorld();
    const queueId = filledQueue(world, 3);
    releasePawnFromQueue(world, queueId);

    const replacement = advanceQueue(world, queueId);
    const members = world.queues.get(queueId)!;

    expect(members).toHaveLength(3);
    expect(members[members.length - 1]).toBe(replacement);
    expect(hasTag(world, replacement, "queued")).toBe(true);
    expect(getQueueId(world, replacement)).toBe(queueId);
    expect(world.positionTweens.get(replacement)!.from).toEqual(slot(3));
    expect(world.positionTweens.get(replacement)!.to).toEqual(slot(2));
  });

  it("re-aims a member already mid-slide from where it now stands, never snapping it back", () => {
    const world = createWorld();
    const queueId = filledQueue(world, 3);

    releasePawnFromQueue(world, queueId);
    advanceQueue(world, queueId);
    timerSystem(world, QUEUE_ADVANCE_DURATION / 2);

    const secondInLine = world.queues.get(queueId)![1];
    const midSlide = world.positions.get(secondInLine)!.clone();

    releasePawnFromQueue(world, queueId);
    advanceQueue(world, queueId);

    const tween = world.positionTweens.get(secondInLine)!;
    expect(tween.from).toEqual(midSlide);
    expect(tween.to).toEqual(slot(0));
  });
});
