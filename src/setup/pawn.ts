import {
  Mesh,
  SphereGeometry,
  type Scene,
  type Vector3,
} from "three";
import {
  BLOCK_COLOR_DARK,
  BLOCK_COLOR_LIGHT,
  PAWN_AMMO,
  PAWN_RADIUS,
} from "../constants";
import { createEntity, type Entity } from "../core/Entity";
import { Position } from "../core/Position";
import type { World } from "../core/World";
import { addTag } from "../core/Tag";
import { addRenderable } from "../render/renderable";
import { standardMaterial } from "../render/materials";
import type { BlockColor } from "../core/Block";

export type SpawnPawnConfig = {
  color: BlockColor;
  position: Vector3;
};

const PAWN_GEOMETRY = new SphereGeometry(PAWN_RADIUS, 16, 12);

const PAWN_COLORS: BlockColor[] = [BLOCK_COLOR_LIGHT, BLOCK_COLOR_DARK];

export function randomPawnColor(): BlockColor {
  return PAWN_COLORS[Math.floor(Math.random() * PAWN_COLORS.length)];
}


export function spawnPawn(
  world: World,
  scene: Scene,
  { color, position }: SpawnPawnConfig,
): Entity {
  const entity = createEntity();

  world.positions.set(entity, Position(position.x, position.y, position.z));
  world.colors.set(entity, color);
  world.ammo.set(entity, PAWN_AMMO);

  addTag(world, entity, "pawn");

  const mesh = new Mesh(PAWN_GEOMETRY, standardMaterial(color));
  mesh.position.copy(position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  addRenderable(world, scene, entity, mesh);

  return entity;
}
