/**
 * Block components. A block's grid slot is all the world stores here — what it
 * matches against lives in `world.flags` (`core/Flag.ts`) and how it is drawn
 * lives in `world.models`.
 */
export type BlockData = {
  column: number;
  row: number;
};
