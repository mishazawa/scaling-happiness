import { pushEvent } from "../core/Event";
import { samplePositionTween } from "../core/Tween";
import type { World } from "../core/World";

/** Owns `world.positionTweens` and `world.countdowns`. Emits: position-tween-complete. */
export function timerSystem(world: World, dt: number): void {
  for (const [entity, tween] of world.positionTweens) {
    tween.elapsed += dt;

    const pos = world.positions.get(entity);
    if (pos) pos.copy(samplePositionTween(tween));

    if (tween.elapsed >= tween.duration) {
      world.positionTweens.delete(entity);
      pushEvent(world, { type: "position-tween-complete", entity });
    }
  }

  for (const [key, countdown] of world.countdowns) {
    countdown.elapsed += dt;

    if (countdown.elapsed >= countdown.duration) {
      world.countdowns.delete(key);
    }
  }
}
