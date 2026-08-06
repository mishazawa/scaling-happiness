import { pushEvent } from "../core/Event";
import { sampleScalarTween, samplePositionTween } from "../core/Tween";
import type { World } from "../core/World";

/**
 * Owns every tween map (`positionTweens`, `scaleTweens`, `rotationTweens`) and
 * `world.countdowns`. Emits: position-tween-complete, scale-tween-complete.
 */
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

  for (const [entity, tween] of world.scaleTweens) {
    tween.elapsed += dt;
    world.scales.set(entity, sampleScalarTween(tween));

    if (tween.elapsed >= tween.duration) {
      world.scaleTweens.delete(entity);
      pushEvent(world, { type: "scale-tween-complete", entity });
    }
  }

  // Silent on completion, unlike the two above: nothing keys off a yaw sweep
  // ending. The death animation it drives is timed by its scale tween instead,
  // which is the one whose end *is* the end.
  for (const [entity, tween] of world.rotationTweens) {
    tween.elapsed += dt;

    const rotation = world.rotations.get(entity);
    if (rotation) rotation.yaw = sampleScalarTween(tween);

    if (tween.elapsed >= tween.duration) world.rotationTweens.delete(entity);
  }

  for (const [key, countdown] of world.countdowns) {
    countdown.elapsed += dt;

    if (countdown.elapsed >= countdown.duration) {
      world.countdowns.delete(key);
    }
  }
}
