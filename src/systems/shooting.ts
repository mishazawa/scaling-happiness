export function shootingSystem(world, dt) {

  const position = new Vector3(some data);

type Side = 0 | 1 | 2 | 3; // counter clock wise bottom right top left

const side: Side = getSideFromPosition(position); 

const spacing = [1, 1];  // from constants

const origin = [
 -spacing[0] * (columnCount - 1) / 2,
-spacing[1] * (rowCount - 1) / 2  
];

let lastFiredLine = null; // per entity

function onFrame () {
  // imagine this code inside system
  // ...

  const horizontal = side === TOP || side === BOTTOM;

  const axisCoord   = horizontal ? position.x : position.y;
  const axisOrigin  = horizontal ? origin[0]  : origin[1];
  const axisSpacing = horizontal ? spacing[0] : spacing[1];
  const axisCount   = horizontal ? columnCount : rowCount;

  const line = Math.round((axisCoord - axisOrigin) / axisSpacing);
  
  if (line === lastFiredLine) return;                                 // already fired
  if (line < 0 || line >= axisCount) return;
  lastFiredLine = line;


  const idx = nearestInLine(line, horizontal, side === TOP || side === LEFT)

    const [row, col] = horizontal
    ? [idx, line]
    : [line, idx];
  
  const index = toFlat([row, col]);

  const entity_block = world.gridToEntity.get(index)

  if (entity_block) {
    destroy(entity_block)
  }
}

function nearestInLine(line: number, horizontal: boolean, forward: boolean) {
  const count = horizontal ? rowCount : columnCount;
  for (let i = 0; i < count; i++) {
    const step = forward ? i : count - 1 - i;
    const index = horizontal ? toFlat([step, line]) : toFlat([line, step]);
    if (world.gridToEntity.has(index)) return step;
  }
  return null;
}
}
