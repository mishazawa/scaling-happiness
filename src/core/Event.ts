import type { Entity } from "./Entity";
import type { World } from "./World";

export type EntityDestroyEvent = {
  type: "entity-destroy" | "spawn-on-lane" | "life-dec" | "life-inc";
  entity: Entity;
};

export type Event = EntityDestroyEvent;

export function pushEvent(world: World, event: Event): void {
  world.events.push(event);
}
