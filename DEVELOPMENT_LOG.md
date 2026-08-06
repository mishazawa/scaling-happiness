# Development Log

A step-by-step account of how this project was built, reconstructed from the git
history (`d5a284b` → `b467248`, 2026-08-05 → 2026-08-06).

The work proceeded in a consistent rhythm: **write the rules → stub the API →
implement → test → wire into `main.ts`**. Several features were developed on
side branches/worktrees and merged back into `main`.

---

## Step 0 — Project bootstrap

**Commits:** `d5a284b` *init*

- Scaffolded a Vite + TypeScript project (`index.html`, `src/main.ts`,
  `src/style.css`, `tsconfig.json`, assets under `src/assets/` and `public/`).
- Standard Vite starter content (`src/counter.ts`, hero image) — removed later.

## Step 1 — Write the game rules first

**Commits:** `1821ff3` *added game rules*, `8fcfa11` *added to game rules*

- Authored `GAME_RULES.md` before any gameplay code. It defines the whole
  design contract that the rest of the work implements:
  - Grid of colored blocks (static — destroyed blocks leave empty cells).
  - A track looping the grid perimeter; every track position faces a **lane**.
  - Pawns: one color + fixed ammo, released manually from a queue.
  - Lives (start at 5): spawning **spends** a life; a pawn that empties its
    ammo **refunds** it; a pawn that laps the track with ammo left does not.
  - Win = grid cleared. Lose = no lives left while blocks remain.

This file remained the reference point for every later system.

## Step 2 — ECS skeleton

**Commits:** `3388f0d` *stubs*, `70b3ba7` *fix*

- Chose a hand-rolled ECS over a framework. Laid down the core:
  - `core/Entity.ts` — entities are just auto-incrementing numbers.
  - `core/Position.ts`, `core/World.ts` — the World is a plain object of
    `Map<Entity, Component>`.
  - `systems/system.ts` — the system signature `(world, dt?, args?) => void`.
  - `systems/movement.ts`, `systems/render.ts` — first two stubs.
  - `setup/block.ts`, `setup/grid.ts`, `setup/light.ts` — factory stubs.
- Replaced the Vite starter `main.ts` with a Three.js scene bootstrap.
- Added `src/constants.ts` as the single home for tunables.
- Added Vitest (`vitest.config.ts`) and the first `movement.test.ts`.

## Step 3 — The block grid

**Commits:** `41975c8`, `3dcbdf7`, `2b0a2cf`, `b4abd66`

1. Implemented `makeGrid` to spawn a checkerboard of colored block entities.
2. Added unit tests for `spawnBlock` and `makeGrid`.
3. Wired `makeGrid` into the `main.ts` bootstrap so the grid actually renders.
4. Added a ground plane (`setup/ground.ts`) beneath the grid.

## Step 4 — Paths and path following

**Commits:** `edb0567`, `b07e124`, `7438a09` (merge), `04f9d3d`, `6d4d2fb`,
`9e769df`, `ec4a55b`/`db875ea` (merges), `6d17bb1`, `5c695c5`, `4d3b832` (merge)

Developed on the `worktree-grid-stub` branch and merged in pieces:

1. **Path data** (`core/Path.ts`): stubbed, then implemented `PathData` with
   per-segment lengths and total length precomputed.
2. **Path following** (`systems/pathFollow.ts`): stubbed, then implemented —
   advances each follower by `speed * dt` along arc length and samples the
   resulting world position. Covered by `pathFollow.test.ts`.
3. **Track generation** (`utils/path.ts`): `makePathAroundTheGrid` builds the
   loop around the grid perimeter, plus a debug visualizer for the track.

## Step 5 — Renderable component (scene mutation centralized)

**Commits:** `e6248be` *added stubs for pawns*, `a59183b`

- Introduced `core/Renderable.ts`: entities own a Three.js `Object3D` as a
  component instead of factories touching the scene graph directly.
- `systems/render.ts` became the only place that syncs `Object3D` transforms
  from position components, and `addRenderable` the only way in.

This refactor is what keeps the setup factories pure and testable.

## Step 6 — Pawns, queues, and click-to-release

**Commits:** `5580c6d`, `b6e052f` (PR #4 merge), `fd45758`, `8822b4d`

1. `setup/pawn.ts` + `setup/queue.ts` + `core/Queue.ts` — pawn entities and the
   ordered line of waiting pawns.
2. `systems/interaction.ts` — click a queued pawn to release it onto the track.
3. `core/Tag.ts` — set-based tag/tagIndex component for ad-hoc categorization.
4. Randomized pawn color and speed (`fd45758`).
5. Queue replenishes itself whenever a pawn is dequeued (`8822b4d`).

Tests added: `Queue.test.ts`, `pawn.test.ts`, `queue.test.ts`.

## Step 7 — Events and deferred destruction

**Commits:** `d01be97`

- `core/Event.ts` — a simple push/consume event queue on the World, so systems
  communicate through events rather than calling each other.
- Entity teardown became **deferred**: systems mark entities, and
  `systems/garbageCollection.ts` removes their components and renderables at a
  fixed point in the frame. This avoids mutating maps mid-iteration.
- `systems/context.ts` — the small `SystemContext` (scene + path entity) passed
  to systems that need scene access.

## Step 8 — Shooting and color matching

**Commits:** `8fd50e8`, `b713e5f`, `6e4fe38`, `084b9e9`, `58dbef3`

1. Stubbed the shooting system.
2. Implemented lane-based targeting: when a pawn newly faces a lane, it finds
   the nearest non-empty block looking inward through empty cells.
3. Added the color-match rule from `GAME_RULES.md` — a pawn only fires when the
   frontmost block in that lane matches its own color (`084b9e9`).
4. Cleanup pass.

## Step 9 — Ammo

**Commits:** `0cd08b8` *ammo*, `9d62c1c`, `577d2dd`

- `core/Ammo.ts` — each shot consumes one unit; a pawn that empties its ammo is
  a *successful* pawn and leaves the track.
- Test suite repaired after the behavior change.

## Step 10 — Lives, win/lose, event refactor

**Commits:** `000bb10` *life check stub*, `3c78d55` *refactor events*, `bd9ebe8`

- `systems/life.ts` — implements the lives accounting from the rules: spend on
  spawn, refund only on success.
- `systems/gameStatus.ts` — win/loss detection driving `world.status`
  (`"playing" | "won" | "lost"`).
- `index.html` gained the `#end-screen` overlay with a repeat button, styled in
  `style.css`.
- Events were refactored into their current shape along the way.

## Step 11 — Timed components (tweens & countdowns)

**Commits:** `9d3a87d`, `7b44a09`, `c375533`, `4dbc270`, `fb0e36e` (merge),
`73175b2`, `87d43a3`, `41dba60`, `eb4089e` (merge)

Developed on the `worktree-timed-components` branch:

1. `core/Tween.ts` (position tweens) and `core/Countdown.ts`, driven by a new
   `systems/timer.ts`.
2. The queue → track spawn was rewired as a **transition**: instead of
   teleporting, a released pawn tweens from its queue slot onto the track
   (`systems/spawn.ts`).
3. The tween destination was parameterized via `TRACK_START_T` rather than
   hardcoded (`c375533`, `4dbc270`), which also fixed a `pathFollow` breakage.
4. Test hygiene: `pathFollow` expectations were re-derived from constants and
   geometry instead of magic numbers (`87d43a3`).
5. `TRACK_START_T` / `TRACK_END_T` were moved into track generation itself —
   the track became an **open** path with an explicit start and end, rather
   than a closed loop sliced at read time (`41dba60`).

## Step 12 — Projectiles

**Commits:** `f3eda79` *projectile system*

- `setup/projectile.ts` — firing now spawns a visible projectile entity instead
  of destroying the block instantly.
- `systems/destruction.ts` — tag-driven teardown: the block is destroyed when
  the projectile resolves.
- `core/Tag.ts` expanded; `shooting`, `gameStatus`, and `garbageCollection`
  updated accordingly, with tests extended across all four.

## Step 13 — Camera and 9:16 framing

**Commits:** `986cc39` *9:16 aspect*

- Locked the presentation to a 9:16 aspect ratio with a tilted (not top-down)
  orthographic camera.
- The frustum is derived **algebraically** in `constants.ts` to exactly frame
  the grid plus the surrounding track — most camera and queue-position
  constants are now derived from a few source values rather than hardcoded.
- `main.ts` gained `updateCameraFrustum`, called on bootstrap and on resize.
- `style.css` was cut down from ~300 lines of starter CSS to just what the game
  needs; added a background image (`public/1.jpg`).

## Step 14 — Documentation refresh

**Commits:** `42edf66`

- Rewrote `CLAUDE.md` to describe the actual ECS architecture: core, systems,
  setup/factories, utils, and the constants conventions.

## Step 15 — Smooth track corners

**Commits:** `b467248` *smooth path*

- Added `roundCorners` in `utils/path.ts`: every interior vertex of the track is
  replaced with a short **quadratic Bézier fillet**, controlled by
  `TRACK_CORNER_RADIUS` and `TRACK_CORNER_SEGMENTS`.
- Endpoints are preserved exactly (pawns spawn at `points[0]` and resolve at the
  last point), and the arcs are sampled once at build time — `Path()` re-measures
  the resulting chords, so followers keep a constant arc-length speed even though
  Bézier parameter sampling isn't uniform in arc length.
- Covered by extended `utils/path.test.ts`.

---

## Current state

**Frame pipeline** (`animate()` in `src/main.ts`, fixed order):

```
pathFollowSystem → shootingSystem → timerSystem → destructionSystem
→ spawnSystem → lifeSystem → renderSystem → garbageCollectionSystem
→ gameStatusSystem → (render) → clearEventsSystem
```

**Layout**

| Directory | Role |
|---|---|
| `src/core/` | `World`, `Entity`, and component definitions (Position, Path, Queue, Ammo, Tween, Countdown, Renderable, Tag, Event) |
| `src/systems/` | One function per concern; all game logic lives here |
| `src/setup/` | One-shot factories: grid, block, pawn, queue, projectile, destroy, ground, light |
| `src/utils/` | Track construction, grid layout, queue layout, shared helpers |
| `src/constants.ts` | Tunables + algebraically derived camera/queue values |

**Testing** — Vitest, tests colocated as `*.test.ts`:
`npm test` (watch) · `npm run test:run` (single run) · `npm run coverage`.

**Stack** — TypeScript ~6.0, Vite ^8.2, Three.js ^0.185, Vitest ^4.1. Strict
bundler-mode `tsconfig` (`verbatimModuleSyntax`, `noUnusedLocals`,
`noUnusedParameters`, `erasableSyntaxOnly`, explicit `.ts` import extensions).
