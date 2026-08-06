export const toFlat = (
  row: number,
  column: number,
  columnCount: number,
): number => row * columnCount + column;

export const toRowColumn = (
  flat: number,
  columnCount: number,
): [row: number, column: number] => [
  Math.floor(flat / columnCount),
  flat % columnCount,
];
