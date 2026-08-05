import { Vector3 } from "three";

export type PositionData = Vector3;

export const Position = (x = 0, y = 0, z = 0): PositionData =>
  new Vector3(x, y, z);
