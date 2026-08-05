import { PAWN_SPEED } from "../constants";
import type { Entity } from "./Entity";
import type { PositionData } from "./Position";

export type PathData = {
  points: PositionData[];
  segLengths: number[];
  total: number;
};

export type PathFollowerData = {
  pathId: Entity;
  t: number;
  speed: number;
  done: boolean;
};

export const Path = (points: PositionData[]): PathData => {
  const segLengths: number[] = [];
  let total = 0;

  for (let i = 0; i < points.length; i++) {
    const next = points[(i + 1) % points.length];
    const length = points[i].distanceTo(next);
    segLengths.push(length);
    total += length;
  }

  return { points, segLengths, total };
};

export const PathFollower = (
  pathId: Entity,
  speed: number = PAWN_SPEED,
): PathFollowerData => ({
  pathId,
  t: 0,
  speed,
  done: false,
});
