import { readEvents } from "../core/Event";
import { hasTag } from "../core/Tag";
import type { World } from "../core/World";
import { markDestroyed } from "../setup/destroy";

/**
 * Resolves projectiles whose flight tween has finished into a block hit.
 * The hit was already decided at fire time (shootingSystem) — this system
 * just applies it once the projectile visually arrives. No collision
 * detection: whatever occupies `targetCell` now is destroyed.
 */
export function destructionSystem(world: World): void {
  for (const event of readEvents(world, "position-tween-complete")) {
    if (!hasTag(world, event.entity, "projectile")) continue;

    markDestroyed(world, event.entity);

    const targetCell = world.projectileTargets.get(event.entity);
    if (targetCell === undefined) continue;

    const blockEntity = world.gridToEntity.get(targetCell);
    if (blockEntity === undefined) continue;

    markDestroyed(world, blockEntity);
  }
}
