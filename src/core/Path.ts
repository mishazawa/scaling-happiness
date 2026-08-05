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

/** Builds an open path through `points` — no closing segment back to the start. */
export const Path = (points: PositionData[]): PathData => {
  const segLengths: number[] = [];
  let total = 0;

  for (let i = 0; i < points.length - 1; i++) {
    const length = points[i].distanceTo(points[i + 1]);
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
