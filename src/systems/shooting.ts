import type { Vector3 } from "three";
import type { Entity } from "../core/Entity";
import { pushEvent } from "../core/Event";
import type { World } from "../core/World";
import type { Grid } from "../setup/grid";
import { toFlat } from "../utils";

type Side = "top" | "right" | "bottom" | "left";

export function shootingSystem(world: World, grid: Grid): void {
  const { columns, rows, cellSize, center } = grid;

  const originX = center.x - ((columns - 1) * cellSize) / 2;
  const originZ = center.z - ((rows - 1) * cellSize) / 2;
  for (const [entity, follower] of world.pathFollowers) {
    if (follower.done) continue;

    const position = world.positions.get(entity);
    if (!position) continue;

    const side = getSide(position, center);
    const horizontal = side === "top" || side === "bottom";
    const sideIndex = SIDES.indexOf(side);

    const axisCoord = horizontal ? position.x : position.z;
    const axisOrigin = horizontal ? originX : originZ;
    const axisCount = horizontal ? columns : rows;

    const raw = Math.round((axisCoord - axisOrigin) / cellSize);
    const lane = Math.min(axisCount - 1, Math.max(0, raw));

    const forward = side === "bottom" || side === "left";

    const last = world.lastFiredLanes.get(entity);
    world.lastFiredLanes.set(entity, laneKeyFor(side, lane));

    // Only interpolate within a side; a side change starts a fresh sweep.
    let from = lane;
    if (last !== undefined && Math.floor(last / 1_000_000) === sideIndex) {
      const lastLane = last % 1_000_000;
      if (lastLane === lane) continue;
      from = lastLane + Math.sign(lane - lastLane);
    }

    const dir = Math.sign(lane - from) || 1;
    for (let l = from; ; l += dir) {
      const blockEntity = findNearestBlockInLane(
        world,
        l,
        horizontal,
        forward,
        columns,
        rows,
      );
      if (blockEntity !== undefined) {
        if (checkColor(world, blockEntity, entity)) {
          pushEvent(world, { type: "entity-destroy", entity: blockEntity });
        }
      }
      if (l === lane) break;
    }
  }
}

const SIDES: Side[] = ["top", "right", "bottom", "left"];

function laneKeyFor(side: Side, lane: number): number {
  return SIDES.indexOf(side) * 1_000_000 + lane;
}

function getSide(position: Vector3, center: Vector3): Side {
  const dx = position.x - center.x;
  const dz = position.z - center.z;

  if (Math.abs(dx) > Math.abs(dz)) {
    return dx > 0 ? "right" : "left";
  }
  return dz > 0 ? "top" : "bottom";
}

function findNearestBlockInLane(
  world: World,
  lane: number,
  horizontal: boolean,
  forward: boolean,
  columns: number,
  rows: number,
): Entity | undefined {
  const count = horizontal ? rows : columns;

  for (let i = 0; i < count; i++) {
    const step = forward ? i : count - 1 - i;
    const [row, column] = horizontal ? [step, lane] : [lane, step];
    const entity = world.gridToEntity.get(toFlat(row, column, columns));
    if (entity !== undefined) return entity;
  }

  return undefined;
}
function checkColor(world: World, blockEntity: Entity, shooterEntity: Entity) {
  return world.colors.get(blockEntity) === world.colors.get(shooterEntity);
}
