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

function Path(points): PathData {}

function PathFollower(pathId, speed): PathFollowerData {}
