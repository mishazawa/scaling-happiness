import type { Vector3 } from "three";
import {
  BLOCK_COLOR_DARK,
  BLOCK_COLOR_LIGHT,
  PALETTE_FOR_COLOR,
  PAWN_AMMO,
} from "../constants";
import { createEntity, type Entity } from "../core/Entity";
import { Model } from "../core/Model";
import { Position } from "../core/Position";
import { addTag } from "../core/Tag";
import type { World } from "../core/World";
import type { BlockColor } from "../core/Block";

export type SpawnPawnConfig = {
  color: BlockColor;
  position: Vector3;
};

const PAWN_COLORS: BlockColor[] = [BLOCK_COLOR_LIGHT, BLOCK_COLOR_DARK];

export function randomPawnColor(): BlockColor {
  return PAWN_COLORS[Math.floor(Math.random() * PAWN_COLORS.length)];
}

/**
 * Pawns are drawn as instances, not as their own `Object3D`, so this doesn't go
 * through `createMeshEntity`: there is no mesh to add to the scene and nothing
 * to register as a renderable. The `models` component is the whole visual state;
 * `renderSystem` packs it into the shared `InstancedMesh` each frame.
 *
 * `world.colors` stays because `shootingSystem` still matches pawns to blocks by
 * `BlockColor`, and blocks haven't migrated to the palette yet.
 *
 * The position is copied, never aliased: `spawnQueuedPawn` passes a queue's live
 * position straight through, and storing it by reference would make every pawn
 * of that queue share one vector.
 */
export function spawnPawn(
  world: World,
  { color, position }: SpawnPawnConfig,
): Entity {
  // An unmapped colour would otherwise reach the render system as an undefined
  // palette row and write NaN into the instance buffer — no error, just row 0.
  const palette = PALETTE_FOR_COLOR[color];
  if (!palette) throw new Error(`no palette mapped for pawn colour: ${color}`);

  const entity = createEntity();

  world.positions.set(entity, Position(position.x, position.y, position.z));
  addTag(world, entity, "pawn");

  world.colors.set(entity, color);
  world.ammo.set(entity, PAWN_AMMO);
  world.models.set(entity, Model("pawn", palette));

  return entity;
}
