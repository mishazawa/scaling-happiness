import type { Event } from "../core/Event";
import { addTag } from "../core/Tag";
import type { World } from "../core/World";
import type { SystemContext } from "./context";

export function eventSystem(world: World, _ctx: SystemContext): void {
  const batch = world.events;
  world.events = [];

  for (const event of batch) {
    dispatch(world, event);
  }
}

function dispatch(world: World, event: Event): void {
  switch (event.type) {
    case "entity-destroy": {
      addTag(world, event.entity, "destroy");
      return;
    }
    // Event currently has one variant, so `Event` isn't a real union yet and
    // TypeScript can't prove a `default: const _exhaustive: never = event`
    // check — add that check back once a second variant exists.
  }
}
