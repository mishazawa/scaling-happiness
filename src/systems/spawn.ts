import { PathFollower } from "../core/Path";
import { PositionTween } from "../core/Tween";
import { Countdown } from "../core/Countdown";
import { pushEvent, readEvents } from "../core/Event";
import { addTag, getEntitiesByTag, hasTag, removeTag } from "../core/Tag";
import type { World } from "../core/World";
import { advanceQueue, releasePawnFromQueue } from "../setup/queue";
import { SPAWN_COOLDOWN, SPAWN_TRANSIT_DURATION } from "../constants";
import type { SystemContext } from "./context";
import { snapToPathDirection } from "./facing";

/**
 * Owns `world.pathFollowers`, queue occupancy (`world.queues` /
 * `world.queueMembership` / `world.spawnOrigins`, via setup/queue.ts), and the
 * "spawning" tag. Reads: queue-clicked, position-tween-complete. Emits:
 * pawn-spawned.
 *
 * A click starts a queue→track position tween (and a per-queue cooldown to
 * stop stacking) rather than attaching a PathFollower immediately — the
 * pawn only joins the path once its tween completes.
 *
 * Everything that happens to the queue it left is deferred to that same
 * moment: nobody moves up and no replacement appears while the pawn is still
 * on its way, so the queue is seen to make room only once the room is free.
 */
export function spawnSystem(world: World, ctx: SystemContext): void {
  let spent = getEntitiesByTag(world, "spawning").size;

  for (const event of readEvents(world, "queue-clicked")) {
    if (world.countdowns.has(event.queue)) continue;
    if (world.lifes - spent <= 0) continue;

    const released = releasePawnFromQueue(world, event.queue);
    if (released === undefined) continue;

    spent += 1;

    const path = world.paths.get(ctx.pathEntity)!;
    const pawnStartPos = world.positions.get(released)!;
    world.positionTweens.set(
      released,
      PositionTween(pawnStartPos, path.points[0], SPAWN_TRANSIT_DURATION),
    );
    addTag(world, released, "spawning");
    world.spawnOrigins.set(released, event.queue);

    world.countdowns.set(event.queue, Countdown(SPAWN_COOLDOWN));
  }

  for (const event of readEvents(world, "position-tween-complete")) {
    if (!hasTag(world, event.entity, "spawning")) continue;

    removeTag(world, event.entity, "spawning");
    world.pathFollowers.set(event.entity, PathFollower(ctx.pathEntity));

    const path = world.paths.get(ctx.pathEntity);
    if (path) snapToPathDirection(world, event.entity, path, 0);

    // The queue it came from closes up now, not at click time.
    const origin = world.spawnOrigins.get(event.entity);
    if (origin !== undefined) {
      world.spawnOrigins.delete(event.entity);
      advanceQueue(world, origin);
    }

    pushEvent(world, { type: "pawn-spawned", entity: event.entity });
  }
}
