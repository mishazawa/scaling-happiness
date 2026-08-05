import type { Entity } from "../core/Entity";
import type { Event } from "../core/Event";
import { PathFollower } from "../core/Path";
import { getQueueId } from "../core/Queue";
import { addTag } from "../core/Tag";
import type { World } from "../core/World";
import { spawnQueuedPawn } from "../setup/queue";
import type { SystemContext } from "./context";

export function eventSystem(world: World, ctx: SystemContext): void {
  const batch = world.events;
  world.events = [];

  for (const event of batch) {
    dispatch(world, event, ctx);
  }
}

function dispatch(world: World, event: Event, ctx: SystemContext): void {
  switch (event.type) {
    case "entity-destroy": {
      addTag(world, event.entity, "destroy");
      return;
    }
    case "spawn-on-lane": {
      const pathEntity = world.paths.keys().next().value!; // seems to be fine
      const queueId = getQueueId(world, event.entity)!;
      world.pathFollowers.set(event.entity, PathFollower(pathEntity));
      spawnQueuedPawn(world, ctx.scene, queueId);
      return;
    }
    // Event currently has one variant, so `Event` isn't a real union yet and
    // TypeScript can't prove a `default: const _exhaustive: never = event`
    // check — add that check back once a second variant exists.
  }
}
