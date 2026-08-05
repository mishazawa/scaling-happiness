export const CAMERA_POSITION: [number, number, number] = [0, 40, 18];
export const LIGHT_MAIN_POSITION: [number, number, number] = [20, 40, 20];
export const BLOCK_SIZE = 0.4;
export const CAMERA_FRUSTUM_SIZE = 20;
export const GRID_COLUMNS = 26;
export const GRID_ROWS = GRID_COLUMNS;
export const GROUND_SIZE = 20;
export const GROUND_COLOR = "#444";

export const PAWN_RADIUS = 0.35;
export const PAWN_SPEED = 10;
export const PAWN_AMMO = 20;

export const QUEUE_POSITION: [number, number, number] = [
  0,
  0,
  GRID_ROWS * BLOCK_SIZE - 2.5,
];
export const QUEUE_DIRECTION: [number, number, number] = [0, 0, 1];
export const QUEUE_SPACING = 1;
export const QUEUE_VERTICAL_SPACING = 3;
export const QUEUE_INITIAL_SIZE = 5;
export const NUMBER_OF_QUEUES = 4;
export const QUEUE_OFFSET = 0;
export const GRID_CLUSTER = 2;
export const LIFES_COUNT = 5;

export const SPAWN_TRANSIT_DURATION = 0.1;
export const SPAWN_COOLDOWN = 0.1;
export const TRACK_START_T = 0.02;
export const TRACK_END_T = 1 - TRACK_START_T;
