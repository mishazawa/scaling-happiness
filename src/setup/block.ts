import { BoxGeometry, type Scene, type Vector3 } from "three";
import { BLOCK_SIZE } from "../constants";
import type { Entity } from "../core/Entity";
import type { World } from "../core/World";
import { standardMaterial } from "../render/materials";
import { createMeshEntity } from "./meshEntity";
import { toFlat } from "../utils/gridMath";
import type { BlockColor } from "../core/Block";

const BLOCK_GEOMETRY = new BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);

export function spawnBlock(
  world: World,
  scene: Scene,
  color: BlockColor,
  row: number,
  column: number,
  totalColumns: number,
  position: Vector3,
): Entity {
  const entity = createMeshEntity(
    world,
    scene,
    "block",
    BLOCK_GEOMETRY,
    standardMaterial(color),
    position,
  );

  world.blocks.set(entity, { row, column });
  world.colors.set(entity, color);
  world.gridToEntity.set(toFlat(row, column, totalColumns), entity);

  return entity;
}
