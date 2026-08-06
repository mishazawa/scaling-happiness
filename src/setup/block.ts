import { Mesh, SphereGeometry, type Vector3 } from "three";
import {
  BLOCK_COLOR_SLOT,
  BLOCK_SEGMENTS,
  BLOCK_MODEL_RADIUS,
} from "../constants";
import { createEntity, type Entity } from "../core/Entity";
import { Model } from "../core/Model";
import { Position } from "../core/Position";
import { addTag } from "../core/Tag";
import type { World } from "../core/World";
import { tagColorSlot } from "../utils/geometry";
import { toFlat } from "../utils/gridMath";
import type { Flag } from "../core/Flag";
import type { PaletteName } from "../core/Model";

/**
 * The source geometry for every block: a bubble.
 *
 * Built here rather than loaded, but registered through the same path as the
 * fish, so it goes through `prepareGeometry` and picks up the palette lookup and
 * the instanced attributes for free. A procedural sphere has no colour regions,
 * so the whole surface is stamped with one slot.
 */
export function makeBubbleMesh(): Mesh {
  return new Mesh(
    tagColorSlot(
      new SphereGeometry(BLOCK_MODEL_RADIUS, BLOCK_SEGMENTS, BLOCK_SEGMENTS),
      BLOCK_COLOR_SLOT,
    ),
  );
}

export type SpawnBlockConfig = {
  /** What pawns must match to shoot this block. */
  flag: Flag;
  /** How the block is drawn. Chosen by the caller, never derived from `flag`. */
  palette: PaletteName;
  row: number;
  column: number;
  totalColumns: number;
  position: Vector3;
};

/**
 * Blocks are drawn as instances, so — like pawns — there is no `Object3D` and
 * nothing to add to the scene. The two identities are independent components:
 * `world.flags` is what `shootingSystem` compares, `world.models` is only how
 * the block looks.
 */
export function spawnBlock(
  world: World,
  { flag, palette, row, column, totalColumns, position }: SpawnBlockConfig,
): Entity {
  const entity = createEntity();

  world.positions.set(entity, Position(position.x, position.y, position.z));
  addTag(world, entity, "block");

  world.blocks.set(entity, { row, column });
  world.flags.set(entity, flag);
  world.gridToEntity.set(toFlat(row, column, totalColumns), entity);
  world.models.set(entity, Model("block", palette));

  return entity;
}
