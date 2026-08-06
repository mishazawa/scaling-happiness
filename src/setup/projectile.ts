import {
  Mesh,
  SphereGeometry,
  type Scene,
  type Vector3,
} from "three";
import {
  PROJECTILE_COLOR,
  PROJECTILE_DURATION,
  PROJECTILE_RADIUS,
} from "../constants";
import { createEntity, type Entity } from "../core/Entity";
import { Position } from "../core/Position";
import { PositionTween } from "../core/Tween";
import { addTag } from "../core/Tag";
import type { World } from "../core/World";
import { addRenderable } from "../render/renderable";
import { standardMaterial } from "../render/materials";

const PROJECTILE_GEOMETRY = new SphereGeometry(PROJECTILE_RADIUS, 8, 6);


/** Spawns a visual-only tween from `from` to `to`; `targetCell` is resolved by destructionSystem once the tween completes. */
export function spawnProjectile(
  world: World,
  scene: Scene,
  from: Vector3,
  to: Vector3,
  targetCell: number,
): Entity {
  const entity = createEntity();

  world.positions.set(entity, Position(from.x, from.y, from.z));
  world.positionTweens.set(
    entity,
    PositionTween(from, to, PROJECTILE_DURATION),
  );
  world.projectileTargets.set(entity, targetCell);

  addTag(world, entity, "projectile");

  const mesh = new Mesh(PROJECTILE_GEOMETRY, standardMaterial(PROJECTILE_COLOR));
  mesh.position.copy(from);

  addRenderable(world, scene, entity, mesh);

  return entity;
}
