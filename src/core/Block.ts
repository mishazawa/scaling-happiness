/**
 * Block components. `BlockColor` is the colour vocabulary for the whole game —
 * pawns and projectiles are matched against it too, which is why it lives in
 * core rather than alongside the block factory.
 */
export type BlockColor = string;

export type BlockData = {
  column: number;
  row: number;
};
