import type { Entity } from "./Entity";
import type { QueueId } from "./Queue";
import type { World } from "./World";

/**
 * Events are past-tense facts one system records about something that
 * happened, for other systems to react to later in the same frame.
 * `world.events` is a single append-only array for the whole frame —
 * producers push onto it, consumers read (never remove) via `readEvents`,
 * and `clearEventsSystem` empties it once, last in the schedule. Because
 * nothing clears the array mid-frame, an event produced earlier in the
 * frame is visible to a consumer scheduled later in the *same* frame.
 */
export type Event =
  | { type: "queue-clicked"; queue: QueueId }
  | { type: "pawn-spawned"; entity: Entity }
  | { type: "pawn-resolved"; entity: Entity; depleted: boolean }
  | { type: "position-tween-complete"; entity: Entity };

export function pushEvent(world: World, event: Event): void {
  world.events.push(event);
}

export function readEvents<T extends Event["type"]>(
  world: World,
  type: T,
): Extract<Event, { type: T }>[] {
  return world.events.filter(
    (event): event is Extract<Event, { type: T }> => event.type === type,
  );
}

/**
 * Documents, and enforces at compile time, which system consumes each event
 * type. `Record<Event["type"], string>` requires every variant to have an
 * entry, so adding a new `Event` variant without a consumer fails to build.
 */
export const EVENT_CONSUMERS = {
  "queue-clicked": "spawnSystem",
  "pawn-spawned": "lifeSystem",
  "pawn-resolved": "lifeSystem",
  "position-tween-complete": "spawnSystem",
} satisfies Record<Event["type"], string>;
