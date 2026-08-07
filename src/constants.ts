export const LIGHT_MAIN_POSITION: [number, number, number] = [5, 10, 10];
export const BLOCK_SIZE = 0.4;
export const GRID_COLUMNS = 26;
export const GRID_ROWS = GRID_COLUMNS;

// The game's whole matching vocabulary. Blocks alternate between these two flags
// and pawns are drawn from the same pair; `shootingSystem` compares them as
// strings. They say nothing about how an entity looks — see `core/Flag.ts`.
export const FLAG_LIGHT = "light";
export const FLAG_DARK = "dark";

export const PROJECTILE_COLOR = "#FFF";

const GRID_WORLD_SIZE = GRID_COLUMNS * BLOCK_SIZE;
const GRID_HALF_SIZE = GRID_WORLD_SIZE / 2;

// Space reserved around the play field for the track to run through.
export const TRACK_PADDING = 2.5;
const TRACK_HALF_SIZE = GRID_HALF_SIZE + TRACK_PADDING;

/**
 * The corners the track runs through, as `[x, y, z]` triples — the shape pawns
 * walk, before `makePathAroundTheGrid` slices it open and fillets the turns.
 *
 * Plain numbers, not `Vector3`: this file is the bottom layer and imports
 * nothing, `three` included, so the geometry stays data that any layer can read
 * and only `setup/track.ts` pays to turn into vectors.
 *
 * Order is the direction of travel, and the list is *closed* — the last corner
 * runs back to the first. The grid is square (GRID_ROWS = GRID_COLUMNS) and
 * centred on the origin, which is why one half-extent covers all four.
 */
export const TRACK_CHECKPOINTS: [number, number, number][] = [
  [-TRACK_HALF_SIZE, 0, TRACK_HALF_SIZE],
  [TRACK_HALF_SIZE, 0, TRACK_HALF_SIZE],
  [TRACK_HALF_SIZE, 0, -TRACK_HALF_SIZE],
  [-TRACK_HALF_SIZE, 0, -TRACK_HALF_SIZE],
];

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
const CAMERA_HALF_WIDTH = TRACK_HALF_SIZE + TRACK_PADDING / 2;
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

// How fast a pawn swings toward the direction it wants to face, in rad/s. A
// quarter turn (the track's corners, and roughly the swing onto a target) takes
// TURN_QUARTER_TIME seconds; expressing it that way keeps the tuning in the
// units the turn is actually judged in.
const TURN_QUARTER_TIME = 0.1;
export const PAWN_TURN_SPEED = Math.PI / 2 / TURN_QUARTER_TIME;

export const QUEUE_DIRECTION: [number, number, number] = [0, 0, 1];
// Which way a pawn faces while it waits its turn. A queue runs down the screen
// along QUEUE_DIRECTION (+z), so a half turn from the model's own forward axis
// points the pawns back up it — facing the grid they are queuing for, and each
// other's tails rather than the camera.
export const QUEUE_PAWN_YAW = Math.PI;
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
export const SPAWN_COOLDOWN = 0.25;
// How long the queue takes to close up behind a released pawn — every pawn in
// it slides a slot forward over this long, rather than snapping.
//
// The slide doesn't begin the moment the pawn is clicked: it waits until that
// pawn has finished its SPAWN_TRANSIT_DURATION hop onto the track, so the queue
// only makes room once the room is actually free. The whole wait from click to
// settled queue is therefore SPAWN_TRANSIT_DURATION + this.
//
// Free to tune on its own — deliberately a plain value rather than derived from
// the two constants around it, which have their own jobs (click pacing, hop
// length). At 0.15 the queue happens to settle just as SPAWN_COOLDOWN lifts and
// the next click becomes legal, which is a nice place to be but not a
// constraint. A zero (or negative) duration would complete on the tween's first
// tick, i.e. teleport, which is the behaviour this exists to replace.
export const QUEUE_ADVANCE_DURATION = 0.15;
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

// A pawn that has resolved — out of ammo, or off the end of the track — spins
// up and shrinks away instead of vanishing on the frame it died. Three tweens,
// all of PAWN_DEATH_DURATION; the scale one is the animation's clock, so the
// duration is what the disappearance is parametrized by and the two speeds
// below are free to be tuned without changing how long a death takes.
export const PAWN_DEATH_DURATION = SPAWN_COOLDOWN;
// Spin about world +Y, rad/s. Multiplied by the duration into a fixed sweep.
export const PAWN_DEATH_SPIN_SPEED = Math.PI * 4;
// Rise along world +Y, units/s — over the duration above, a little under a
// pawn's own diameter, so it lifts clear of the track without leaving frame.
export const PAWN_DEATH_RISE_SPEED = 10;
// Scale the pawn shrinks to. Zero: "complete disappearance", by the time the
// tween that ends the animation ends.
export const PAWN_DEATH_END_SCALE = 0;

export const PROJECTILE_DURATION = 0.05;
export const PROJECTILE_RADIUS = 0.1;

const ACCENT_COLOR = 0xfa6781;
const BLACK_COLOR = 0x0a1a2e;
const WHITE_COLOR = 0xffffff;

/**
 * One palette per entry: the three shared colours plus this palette's own main
 * one. Adding a key here adds a palette everywhere — the texture grows a row,
 * `PALETTES_IDX` grows an entry, and `PaletteName` (`core/Model.ts`) widens.
 */
const MAIN_COLORS = {
  koi: 0xff3b77,
  tide: 0x52656b,
  mermaid: 0xfdcb2a,
  poster: 0x0d8aa6,
  ocean1: 0x117fd5,
  ocean2: 0x02938b,
  ocean3: 0xc6fce8,
  ocean4: 0x64c6e3,
  ocean5: 0x54e0ca,
};
export const GROUND_COLOR = MAIN_COLORS.ocean1;

/**
 * Palette names, in declaration order. The whole palette system keys off this
 * type: a plain `Object.entries` reduce would infer `{}` here and collapse
 * `PaletteName` to `never`, which type-checks at every call site while silently
 * accepting nothing.
 */
type MainColorName = keyof typeof MAIN_COLORS;

const PALETTE_NAMES = Object.keys(MAIN_COLORS) as MainColorName[];

// assemble palette
export const PALETTES = Object.fromEntries(
  PALETTE_NAMES.map((name) => [
    name,
    [ACCENT_COLOR, MAIN_COLORS[name], BLACK_COLOR, WHITE_COLOR],
  ]),
) as Record<MainColorName, number[]>;

const LIGHT_IDX = 0;
const DARK_IDX = 2;

export const LIGHT_PALETTE_SLOT = PALETTE_NAMES[LIGHT_IDX];
export const DARK_PALETTE_SLOT = PALETTE_NAMES[DARK_IDX];

/** Row each palette occupies in the lookup texture — its declaration order. */
export const PALETTES_IDX = Object.fromEntries(
  PALETTE_NAMES.map((name, i) => [name, i]),
) as Record<MainColorName, number>;

/**
 * Per-vertex colour-region tag exported from Blender. `prepareGeometry` aliases
 * it to `aID`, the name the palette shader declares.
 */
export const COLOR_ATTRIBUTE = "_color_id";

/**
 * Models are normalized into a bounding radius at registration, so an entity's
 * size is settled before the ECS sees it — the per-entity `scales` component
 * only ever multiplies this, and only while something animates it (see
 * `core/Scale.ts`). The pawn's radius matches the sphere it used to be drawn
 * as, keeping the track and queue layout unchanged; the block's fills its grid
 * cell, so the bubbles sit shoulder to shoulder.
 */
export const PAWN_MODEL_RADIUS = PAWN_RADIUS;
export const BLOCK_MODEL_RADIUS = BLOCK_SIZE / 2;

/**
 * Yaw, in radians, that turns a model's authored forward axis into world +Z —
 * the axis `yawFromDirection` measures headings from. It exists so a model
 * exported facing some other way costs one constant rather than an offset at
 * every site that computes a heading.
 *
 * Zero is an *inference*, not a measurement: the fish's long axis is z, and the
 * flat, tall profile at its -z end reads as a caudal fin, which puts the nose at
 * +z. That was never confirmed on screen. If the fish swims backwards, this is
 * `Math.PI`; if it swims sideways, `±Math.PI / 2`.
 */
export const MODEL_FORWARD_YAW_OFFSET = 0;

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

/**
 * The track is scenery, not an ECS entity: a single un-instanced mesh, drawn
 * once, never spawned or despawned. It carries no `_color_id`, so instead of
 * the palette LUT its static half takes a flat colour, and its moving half the
 * arrow texture.
 */
/** Node names the track's two halves are exported under. */
export const TRACK_STATIC_PART = "Static";
export const TRACK_MOVING_PART = "Moving";
export const TRACK_STATIC_COLOR = MAIN_COLORS.ocean4;

/**
 * How many arrow tiles fit around the belt.
 *
 * The tile is square, so square-looking arrows want the belt's length divided
 * by its width: measured off the export, that is 58.5 / 1.48 ≈ 40. Raise it for
 * smaller, denser arrows; the belt's uvs run 0..1 along its length, so this is
 * the tile count for the whole loop.
 */
export const TRACK_ARROW_REPEAT = 20;

/**
 * The belt is viewed at a grazing angle from a tilted camera and is tiled 40
 * times along its length, so its mips are heavily minified — the case
 * anisotropic filtering exists for. Three clamps this to whatever the GPU
 * supports.
 */
export const TRACK_ARROW_ANISOTROPY = 8;
export const TRACK_SPEED = 1;
export const SHADER_BREATH_AMP = 0.1;
export const SHADER_BREATH_FREQ = 8.9;
