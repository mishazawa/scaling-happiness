import {
  Mesh,
  type BufferGeometry,
  type Material,
  type Scene,
  type Vector3,
} from "three";
import { createEntity, type Entity } from "../core/Entity";
import { Position } from "../core/Position";
import { addTag, type Tag } from "../core/Tag";
import type { World } from "../core/World";
import { addRenderable } from "../render/renderable";

/**
 * Creates an entity with a position component and a mesh registered into the
 * scene — the invariant every spawner has to maintain identically.
 *
 * The position is copied, never aliased: spawnQueuedPawn passes a queue's live
 * position straight through, and storing it by reference would make every pawn
 * share that vector.
 */
export function createMeshEntity(
  world: World,
  scene: Scene,
  tag: Tag,
  geometry: BufferGeometry,
  material: Material,
  position: Vector3,
  { shadows = true }: { shadows?: boolean } = {},
): Entity {
  const entity = createEntity();

  world.positions.set(entity, Position(position.x, position.y, position.z));

  addTag(world, entity, tag);

  const mesh = new Mesh(geometry, material);
  mesh.position.copy(position);
  mesh.castShadow = shadows;
  mesh.receiveShadow = shadows;

  addRenderable(world, scene, entity, mesh);

  return entity;
}
