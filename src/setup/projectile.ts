import { SphereGeometry, type Scene, type Vector3 } from "three";
import {
  PROJECTILE_COLOR,
  PROJECTILE_DURATION,
  PROJECTILE_RADIUS,
} from "../constants";
import { PositionTween } from "../core/Tween";
import type { Entity } from "../core/Entity";
import type { World } from "../core/World";
import { standardMaterial } from "../render/materials";
import { createMeshEntity } from "./meshEntity";

const PROJECTILE_GEOMETRY = new SphereGeometry(PROJECTILE_RADIUS, 8, 6);

/** Spawns a visual-only tween from `from` to `to`; `targetCell` is resolved by destructionSystem once the tween completes. */
export function spawnProjectile(
  world: World,
  scene: Scene,
  from: Vector3,
  to: Vector3,
  targetCell: number,
): Entity {
  // Projectiles are small, short-lived and cast no shadow.
  const entity = createMeshEntity(
    world,
    scene,
    "projectile",
    PROJECTILE_GEOMETRY,
    standardMaterial(PROJECTILE_COLOR),
    from,
    { shadows: false },
  );

  world.positionTweens.set(
    entity,
    PositionTween(from, to, PROJECTILE_DURATION),
  );
  world.projectileTargets.set(entity, targetCell);

  return entity;
}
