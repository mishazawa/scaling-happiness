import { PathFollower } from "../core/Path";
import { pushEvent, readEvents } from "../core/Event";
import type { World } from "../core/World";
import { releasePawnFromQueue, spawnQueuedPawn } from "../setup/queue";
import type { SystemContext } from "./context";

/**
 * Owns `world.pathFollowers` and queue occupancy (`world.queues` /
 * `world.queueMembership`, via setup/queue.ts).
 * Reads: queue-clicked. Emits: pawn-spawned.
 */
export function spawnSystem(world: World, ctx: SystemContext): void {
  for (const event of readEvents(world, "queue-clicked")) {
    const released = releasePawnFromQueue(world, event.queue);
    if (released === undefined) continue;

    world.pathFollowers.set(released, PathFollower(ctx.pathEntity));
    spawnQueuedPawn(world, ctx.scene, event.queue);
    pushEvent(world, { type: "pawn-spawned", entity: released });
  }
}
