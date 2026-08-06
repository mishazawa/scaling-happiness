import { SphereGeometry, type Scene, type Vector3 } from "three";
import {
  BLOCK_COLOR_DARK,
  BLOCK_COLOR_LIGHT,
  PAWN_AMMO,
  PAWN_RADIUS,
} from "../constants";
import type { Entity } from "../core/Entity";
import type { World } from "../core/World";
import { standardMaterial } from "../render/materials";
import { createMeshEntity } from "./meshEntity";
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
  const entity = createMeshEntity(
    world,
    scene,
    "pawn",
    PAWN_GEOMETRY,
    standardMaterial(color),
    position,
  );

  world.colors.set(entity, color);
  world.ammo.set(entity, PAWN_AMMO);

  return entity;
}
