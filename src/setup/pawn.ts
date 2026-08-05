import {
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  type Scene,
  type Vector3,
} from "three";
import { PAWN_RADIUS } from "../constants";
import { createEntity, type Entity } from "../core/Entity";
import { Position } from "../core/Position";
import type { World } from "../core/World";
import { addTag } from "../core/Tag";
import { addRenderable } from "../systems/render";
import type { BlockColor } from "./block";

export type SpawnPawnConfig = {
  color: BlockColor;
  position: Vector3;
};

const PAWN_GEOMETRY = new SphereGeometry(PAWN_RADIUS, 16, 12);

const materialsByColor = new Map<BlockColor, MeshStandardMaterial>();

function getPawnMaterial(color: BlockColor): MeshStandardMaterial {
  let material = materialsByColor.get(color);
  if (!material) {
    material = new MeshStandardMaterial({ color });
    materialsByColor.set(color, material);
  }
  return material;
}

export function spawnPawn(
  world: World,
  scene: Scene,
  { color, position }: SpawnPawnConfig,
): Entity {
  const entity = createEntity();

  world.positions.set(entity, Position(position.x, position.y, position.z));
  world.colors.set(entity, color);

  addTag(world, entity, "pawn");

  const mesh = new Mesh(PAWN_GEOMETRY, getPawnMaterial(color));
  mesh.position.copy(position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  addRenderable(world, scene, entity, mesh);

  return entity;
}
