import type { PaletteName } from "./core/Model";

export const LIGHT_MAIN_POSITION: [number, number, number] = [20, 40, 20];
export const BLOCK_SIZE = 0.4;
export const GRID_COLUMNS = 26;
export const GRID_ROWS = GRID_COLUMNS;
export const GROUND_COLOR = "#B8B89F";

// The game's whole matching vocabulary. Blocks alternate between these two flags
// and pawns are drawn from the same pair; `shootingSystem` compares them as
// strings. They say nothing about how an entity looks — see `core/Flag.ts`.
export const FLAG_LIGHT = "light";
export const FLAG_DARK = "dark";

export const PROJECTILE_COLOR = "#FFF";

const GRID_WORLD_SIZE = GRID_COLUMNS * BLOCK_SIZE;
const GRID_HALF_SIZE = GRID_WORLD_SIZE / 2;

// Space reserved around the play field for the track to run through.
export const TRACK_PADDING = 1;
const TRACK_HALF_SIZE = GRID_HALF_SIZE + TRACK_PADDING;

// The game screen is locked to a 9:16 (portrait) frame, letterboxed to fit
// whatever viewport it's shown in.
export const ASPECT_RATIO = 9 / 16;

// Camera is tilted (not a pure top-down view): it sits above and behind the
// grid, looking down and forward. Its horizontal (x) axis maps 1:1 to screen
// x, but its vertical screen axis is a blend of world y and z, compressed by
// this factor relative to raw world-z distance.
const CAMERA_TILT_Y = 40;
const CAMERA_TILT_Z = 18;
const CAMERA_TILT_LENGTH = Math.hypot(CAMERA_TILT_Y, CAMERA_TILT_Z);
const CAMERA_DEPTH_TO_SCREEN_Y = CAMERA_TILT_Y / CAMERA_TILT_LENGTH;

// Frustum width is sized to fit the grid + its track padding exactly; height
// follows from the locked aspect ratio, so the play field is always fully
// visible with no wasted horizontal space.
const CAMERA_HALF_WIDTH = TRACK_HALF_SIZE + 1;
const CAMERA_HALF_HEIGHT = CAMERA_HALF_WIDTH / ASPECT_RATIO;
export const CAMERA_FRUSTUM_SIZE = CAMERA_HALF_HEIGHT * 2;

// Clip planes. Generous either side of the tilted camera's distance to the grid.
export const CAMERA_NEAR = 0.1;
export const CAMERA_FAR = 1000;

// Breathing room between the screen's top edge and the track.
const SCREEN_TOP_MARGIN = 5;
const screenTopZ = -TRACK_HALF_SIZE - SCREEN_TOP_MARGIN;

// Camera looks at a point offset along z (rather than the grid center) so
// that, given the fixed frustum height above, the screen's bottom edge lands
// where the queues need it to (see below). Position keeps the same tilt
// offset from that target as before.
const CAMERA_TARGET_Z =
  screenTopZ + CAMERA_HALF_HEIGHT / CAMERA_DEPTH_TO_SCREEN_Y;
export const CAMERA_TARGET: [number, number, number] = [0, 0, CAMERA_TARGET_Z];
export const CAMERA_POSITION: [number, number, number] = [
  0,
  CAMERA_TILT_Y,
  CAMERA_TILT_Z + CAMERA_TARGET_Z,
];

const screenBottomZ =
  CAMERA_TARGET_Z + CAMERA_HALF_HEIGHT / CAMERA_DEPTH_TO_SCREEN_Y;

// Ground plane just needs to cover everything the camera can see.
export const GROUND_SIZE = Math.ceil(screenBottomZ) * 2 + 4;

export const PAWN_RADIUS = 1;
export const PAWN_SPEED = 10;
export const PAWN_AMMO = 20;

export const QUEUE_DIRECTION: [number, number, number] = [0, 0, 1];
// Depth spacing between pawns within a single queue.
export const QUEUE_SPACING = 2.5;
export const QUEUE_VERTICAL_SPACING = 1;
export const QUEUE_INITIAL_SIZE = 5;
export const NUMBER_OF_QUEUES = 4;
export const GRID_CLUSTER = 2;
export const LIFES_COUNT = 5;

// The 4 queues sit side by side, evenly spanning the same width as the grid.
export const QUEUE_COLUMN_SPACING = GRID_WORLD_SIZE / NUMBER_OF_QUEUES;
export const QUEUE_OFFSET = -GRID_HALF_SIZE + QUEUE_COLUMN_SPACING / 2;

// A sphere of PAWN_RADIUS projects (orthographically) to a screen-space
// circle of the same radius, in the same units as CAMERA_HALF_HEIGHT — unlike
// a position, its radius isn't subject to the world-z -> screen-Y
// compression above. Converting that radius back into a world-z distance
// (dividing by the compression factor) gives how far, in z, a pawn's center
// must sit from screenBottomZ to be fully in or fully out of frame.
const PAWN_RADIUS_AS_Z_DISTANCE = PAWN_RADIUS / CAMERA_DEPTH_TO_SCREEN_Y;
// Last fully-visible and first fully-hidden queue slots, straddling the
// screen's bottom edge.
const lastVisiblePawnZ = screenBottomZ - PAWN_RADIUS_AS_Z_DISTANCE;
const firstHiddenPawnZ = screenBottomZ + PAWN_RADIUS_AS_Z_DISTANCE;
// How many queue slots are on screen. The last visible slot must land at or
// before lastVisiblePawnZ (to be fully visible) while the next one lands at or
// after firstHiddenPawnZ (to be fully hidden); centering it between those two
// requirements splits the margin evenly. Also sizes the queue's click box.
export const QUEUE_VISIBLE_SLOTS = 3;
const lastSlotZ = (lastVisiblePawnZ + (firstHiddenPawnZ - QUEUE_SPACING)) / 2;
export const QUEUE_POSITION: [number, number, number] = [
  0,
  0,
  lastSlotZ - (QUEUE_VISIBLE_SLOTS - 1) * QUEUE_SPACING,
];

export const SPAWN_TRANSIT_DURATION = 0.1;
export const SPAWN_COOLDOWN = 0.1;
export const TRACK_START_T = 0.02;
export const TRACK_END_T = 1 - TRACK_START_T;

// Track corners are rounded (filleted) instead of snapping 90°. The radius is
// in world units, measured from the sharp corner back along each adjoining
// segment. Ceiling is ~1.6: a fillet pulls the path toward the grid's corner
// block by r * (√2 - 1), and with TRACK_PADDING = 1 the diagonal gap is only
// √2 ≈ 1.414, so past that a pawn (PAWN_RADIUS) starts clipping the corner.
export const TRACK_CORNER_RADIUS = 1;
// Line segments generated per rounded corner. 0 (or a 0 radius) turns rounding
// off and restores hard corners.
export const TRACK_CORNER_SEGMENTS = 8;

export const PROJECTILE_DURATION = 0.05;
export const PROJECTILE_RADIUS = 0.1;

const ACCENT_COLOR = 0xfa6781;
const BLACK_COLOR = 0x0a1a2e;
const WHITE_COLOR = 0xffffff;

const MAIN_COLORS = {
  koi: 0xff3b77,
  tide: 0x52656b,
  mermaid: 0xfdcb2a,
  poster: 0x0d8aa6,
};

// assemble palette
export const PALETTES = Object.entries(MAIN_COLORS).reduce(
  (acc, e) => ({
    ...acc,
    ...{ [e[0]]: [ACCENT_COLOR, e[1], BLACK_COLOR, WHITE_COLOR] },
  }),
  {},
);

const LIGHT_IDX = 0;
const DARK_IDX = 2;

export const LIGHT_PALETTE_SLOT = Object.keys(PALETTES)[
  LIGHT_IDX
] as PaletteName;
export const DARK_PALETTE_SLOT = Object.keys(PALETTES)[DARK_IDX] as PaletteName;

export const PALETTES_IDX = Object.keys(PALETTES).reduce(
  (acc, k, i) => ({ ...acc, ...{ [k]: i } }),
  {},
) as Record<PaletteName, number>;

/**
 * Per-vertex colour-region tag exported from Blender. `prepareGeometry` aliases
 * it to `aID`, the name the palette shader declares.
 */
export const COLOR_ATTRIBUTE = "_color_id";

/**
 * Models are normalized into a bounding radius at registration, so the ECS never
 * carries a per-entity scale. The pawn's matches the sphere it used to be drawn
 * as, keeping the track and queue layout unchanged; the block's fills its grid
 * cell, so the bubbles sit shoulder to shoulder.
 */
export const PAWN_MODEL_RADIUS = PAWN_RADIUS;
export const BLOCK_MODEL_RADIUS = BLOCK_SIZE / 2;

/** How round the block bubbles are. Low enough that 676 of them stay cheap. */
export const BLOCK_SEGMENTS = 12;

/**
 * Palette slot the block bubbles draw with. Unlike the fish, which carries a
 * per-vertex `_color_id` from Blender, a procedural sphere is one flat region,
 * so every vertex gets this slot.
 */
export const BLOCK_COLOR_SLOT = 1;

/**
 * Instanced draw capacity, fixed per model. Exceeding one is a bug in the game
 * rules that bound it, not a condition to recover from, so the render system
 * throws rather than growing the buffers.
 */
export const PAWN_CAPACITY = 256;
export const BLOCK_CAPACITY = GRID_COLUMNS * GRID_ROWS;

export const SHADER_BREATH_AMP = 0.1;
export const SHADER_BREATH_FREQ = 8.9;
