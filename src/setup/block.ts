import { Mesh, SphereGeometry, type Vector3 } from "three";
import {
  BLOCK_COLOR_SLOT,
  BLOCK_SEGMENTS,
  BLOCK_MODEL_RADIUS,
  PALETTE_FOR_COLOR,
} from "../constants";
import { createEntity, type Entity } from "../core/Entity";
import { Model } from "../core/Model";
import { Position } from "../core/Position";
import { addTag } from "../core/Tag";
import type { World } from "../core/World";
import { tagColorSlot } from "../utils/geometry";
import { toFlat } from "../utils/gridMath";
import type { BlockColor } from "../core/Block";

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

/**
 * Blocks are drawn as instances, so — like pawns — there is no `Object3D` and
 * nothing to add to the scene. `world.colors` stays as the gameplay truth:
 * `shootingSystem` matches pawn to block by `BlockColor` string equality, and
 * the palette is only how the block is drawn.
 */
export function spawnBlock(
  world: World,
  color: BlockColor,
  row: number,
  column: number,
  totalColumns: number,
  position: Vector3,
): Entity {
  const palette = PALETTE_FOR_COLOR[color];
  if (!palette) throw new Error(`no palette mapped for block colour: ${color}`);

  const entity = createEntity();

  world.positions.set(entity, Position(position.x, position.y, position.z));
  addTag(world, entity, "block");

  world.blocks.set(entity, { row, column });
  world.colors.set(entity, color);
  world.gridToEntity.set(toFlat(row, column, totalColumns), entity);
  world.models.set(entity, Model("block", palette));

  return entity;
}
