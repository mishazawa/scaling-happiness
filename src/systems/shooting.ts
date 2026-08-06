import type { Vector3 } from "three";
import type { Entity } from "../core/Entity";
import { pushEvent } from "../core/Event";
import { addTag, hasTag } from "../core/Tag";
import type { World } from "../core/World";
import type { Grid } from "../core/Grid";
import { toFlat, worldToLane } from "../utils/gridMath";
import { spawnProjectile } from "../setup/projectile";
import type { SystemContext } from "./context";

type Side = "top" | "right" | "bottom" | "left";

/**
 * Produces (via core/Event.ts): "targeted" and "aiming" tags, pawn-resolved
 * (ammo depleted). Nothing is destroyed here directly. A hit tags the block
 * "targeted" and spawns a projectile, and destructionSystem applies the actual
 * destroy once the projectile lands; a depleted shooter is resolved, and
 * deathSystem takes it from there once its death animation has played.
 */
export function shootingSystem(
  world: World,
  grid: Grid,
  ctx: SystemContext,
): void {
  const { columns, rows, center } = grid;

  for (const [entity, follower] of world.pathFollowers) {
    if (follower.done) continue;

    const position = world.positions.get(entity);
    if (!position) continue;

    const side = getSide(position, center);
    const horizontal = side === "top" || side === "bottom";
    const sideIndex = SIDES.indexOf(side);

    const lane = horizontal
      ? worldToLane(grid, position.x, "x")
      : worldToLane(grid, position.z, "z");

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
      if (
        blockEntity !== undefined &&
        !hasTag(world, blockEntity, "targeted")
      ) {
        if (flagsMatch(world, blockEntity, entity)) {
          addTag(world, blockEntity, "targeted");

          const block = world.blocks.get(blockEntity)!;
          const shooterPosition = world.positions.get(entity)!;
          const blockPosition = world.positions.get(blockEntity)!;
          spawnProjectile(
            world,
            ctx.scene,
            shooterPosition,
            blockPosition,
            toFlat(block.row, block.column, columns),
          );

          // Taking a shot turns the pawn to the field for good — from here on
          // `facingSystem` squares it up to the grid every frame instead of
          // steering it along the track. Which block it hit doesn't enter into
          // it: the aim is a major axis, not a bearing on a target.
          addTag(world, entity, "aiming");

          const depleted = depleteAmmo(world, entity);
          if (depleted) {
            pushEvent(world, { type: "pawn-resolved", entity, depleted });
            break;
          }
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
/**
 * A shot connects only when both entities carry the same flag. Palettes are
 * deliberately not consulted: how a pawn or block is drawn is free to change
 * without changing what it can hit.
 */
function flagsMatch(world: World, blockEntity: Entity, shooterEntity: Entity) {
  const flag = world.flags.get(shooterEntity);
  return flag !== undefined && world.flags.get(blockEntity) === flag;
}

// Returns true when the shooter just fired its last round.
function depleteAmmo(world: World, shooterEntity: Entity): boolean {
  const ammo = world.ammo.get(shooterEntity);
  if (ammo === undefined) return false;

  const remaining = ammo - 1;
  world.ammo.set(shooterEntity, remaining);
  return remaining <= 0;
}
