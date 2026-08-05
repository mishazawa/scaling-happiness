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

    const axisCoord = horizontal ? position.x : position.z;
    const axisOrigin = horizontal ? originX : originZ;
    const axisCount = horizontal ? columns : rows;

    const lane = Math.round((axisCoord - axisOrigin) / cellSize);
    if (lane < 0 || lane >= axisCount) continue;

    // Lane indices are only unique within a side: column 7 on the bottom
    // edge and row 7 on the right edge are different lanes with the same
    // number, so the memory key must include the side.
    const laneKey = laneKeyFor(side, lane);
    const lastLaneKey = world.lastFiredLanes.get(entity);
    if (laneKey === lastLaneKey) continue;
    world.lastFiredLanes.set(entity, laneKey);

    // Inward means toward smaller row/column on bottom/left, toward larger on top/right.
    const forward = side === "bottom" || side === "left";

    const blockEntity = findNearestBlockInLane(
      world,
      lane,
      horizontal,
      forward,
      columns,
      rows,
    );
    if (blockEntity === undefined) continue;

    pushEvent(world, { type: "entity-destroy", entity: blockEntity });
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
