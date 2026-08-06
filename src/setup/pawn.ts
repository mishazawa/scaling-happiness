import type { Vector3 } from "three";
import {
  DARK_PALETTE_SLOT,
  FLAG_DARK,
  FLAG_LIGHT,
  LIGHT_PALETTE_SLOT,
  PAWN_AMMO,
} from "../constants";
import { createEntity, type Entity } from "../core/Entity";
import { Model, type PaletteName } from "../core/Model";
import { Position } from "../core/Position";
import { addTag } from "../core/Tag";
import type { World } from "../core/World";
import type { Flag } from "../core/Flag";

export type SpawnPawnConfig = {
  /** Which blocks this pawn is allowed to shoot. */
  flag: Flag;
  /** How the pawn is drawn. Chosen by the caller, never derived from `flag`. */
  palette: PaletteName;
  position: Vector3;
};

export type PawnKind = { flag: Flag; palette: PaletteName };

/**
 * The pawns the game deals out. Each entry states its palette outright — the
 * pairing is an authoring choice made here, not a lookup, so a flag's look can
 * be changed without touching anything that matches on it.
 */
const PAWN_KINDS: PawnKind[] = [
  { flag: FLAG_LIGHT, palette: LIGHT_PALETTE_SLOT },
  { flag: FLAG_DARK, palette: DARK_PALETTE_SLOT },
];

export function randomPawnKind(): PawnKind {
  return PAWN_KINDS[Math.floor(Math.random() * PAWN_KINDS.length)];
}

/**
 * Pawns are drawn as instances, not as their own `Object3D`, so this doesn't go
 * through `createMeshEntity`: there is no mesh to add to the scene and nothing
 * to register as a renderable. The `models` component is the whole visual state;
 * `renderSystem` packs it into the shared `InstancedMesh` each frame.
 *
 * `world.flags` is the gameplay half of that split: `shootingSystem` compares a
 * pawn's flag with a block's, and never looks at either one's palette.
 *
 * The position is copied, never aliased: `spawnQueuedPawn` passes a queue's live
 * position straight through, and storing it by reference would make every pawn
 * of that queue share one vector.
 */
export function spawnPawn(
  world: World,
  { flag, palette, position }: SpawnPawnConfig,
): Entity {
  const entity = createEntity();

  world.positions.set(entity, Position(position.x, position.y, position.z));
  addTag(world, entity, "pawn");

  world.flags.set(entity, flag);
  world.ammo.set(entity, PAWN_AMMO);
  world.models.set(entity, Model("pawn", palette));

  return entity;
}
