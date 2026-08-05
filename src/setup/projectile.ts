import {
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  type Scene,
  type Vector3,
} from "three";
import { PROJECTILE_DURATION, PROJECTILE_RADIUS } from "../constants";
import { createEntity, type Entity } from "../core/Entity";
import { Position } from "../core/Position";
import { PositionTween } from "../core/Tween";
import { addTag } from "../core/Tag";
import type { World } from "../core/World";
import { addRenderable } from "../systems/render";
import type { BlockColor } from "./block";

const PROJECTILE_GEOMETRY = new SphereGeometry(PROJECTILE_RADIUS, 8, 6);

const materialsByColor = new Map<BlockColor, MeshStandardMaterial>();

function getProjectileMaterial(color: BlockColor): MeshStandardMaterial {
  let material = materialsByColor.get(color);
  if (!material) {
    material = new MeshStandardMaterial({ color });
    materialsByColor.set(color, material);
  }
  return material;
}

/** Spawns a visual-only tween from `from` to `to`; `targetCell` is resolved by destructionSystem once the tween completes. */
export function spawnProjectile(
  world: World,
  scene: Scene,
  color: BlockColor,
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

  const mesh = new Mesh(PROJECTILE_GEOMETRY, getProjectileMaterial("#FFF"));
  mesh.position.copy(from);

  addRenderable(world, scene, entity, mesh);

  return entity;
}
