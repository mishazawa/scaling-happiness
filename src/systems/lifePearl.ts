import { markDestroyed } from "../core/destroy";
import { readEvents } from "../core/Event";
import { hasTag } from "../core/Tag";
import type { World } from "../core/World";
import { spawnLifePearl } from "../setup/lifePearl";
import type { SystemContext } from "./context";

/**
 * Shows what `lifeSystem` did, at the pearl standing where the pawns swim out.
 *
 * One pearl per frame in which the count moved, whichever way and however far —
 * that pearl reads as a place lifes come from, not as a tally, and two lifes
 * lost to one frame's clicks is still one thing happening.
 *
 * Reads: life-changed, scale-tween-complete. Produces (via destroy.ts): the
 * "destroy" tag.
 */
export function lifePearlSystem(world: World, ctx: SystemContext): void {
  for (const event of readEvents(world, "life-changed")) {
    spawnLifePearl(world, ctx.scene, event.delta < 0 ? "spent" : "refunded");
  }

  // The scale tween is the animation's clock, exactly as it is for a death, and
  // the tag is what keeps this off the deaths that share the event.
  for (const event of readEvents(world, "scale-tween-complete")) {
    if (!hasTag(world, event.entity, "life-pearl")) continue;
    markDestroyed(world, event.entity);
  }
}
