import { describe, it, expect } from "vitest";
import { createWorld } from "./World";
import { createEntity } from "./Entity";
import { dequeue, enqueue, getQueueId } from "./Queue";

describe("Queue", () => {
  it("dequeues members in FIFO order", () => {
    const world = createWorld();
    const queueId = createEntity();
    const a = createEntity();
    const b = createEntity();
    const c = createEntity();

    enqueue(world, queueId, a);
    enqueue(world, queueId, b);
    enqueue(world, queueId, c);

    expect(dequeue(world, queueId)).toBe(a);
    expect(dequeue(world, queueId)).toBe(b);
    expect(dequeue(world, queueId)).toBe(c);
  });

  it("returns undefined when dequeuing an empty or unknown queue", () => {
    const world = createWorld();
    const queueId = createEntity();

    expect(dequeue(world, queueId)).toBeUndefined();
  });

  it("tracks which queue an entity belongs to, and clears it on dequeue", () => {
    const world = createWorld();
    const queueId = createEntity();
    const entity = createEntity();

    enqueue(world, queueId, entity);
    expect(getQueueId(world, entity)).toBe(queueId);

    dequeue(world, queueId);
    expect(getQueueId(world, entity)).toBeUndefined();
  });
});
