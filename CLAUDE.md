# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Testing

- do NOT run any external long living processes (dev servers, chromium, etc.)
- do NOT perform any smoke tests
- use typescript linter and test suites (vitest)

## Project state

A working game, built on Three.js with a hand-rolled ECS. Pawns of different kinds queue up, spawn onto a track that loops around a grid of blocks, and shoot flag-matched blocks off the grid as they path around it; losing all lifes or clearing the grid ends the round. `index.html` hosts `#app` (the WebGL canvas mount) and an `#end-screen` overlay with a repeat button. `src/main.ts` is the entry point: it sets up the Three.js scene/camera/renderer, builds the world, and drives the per-frame system pipeline via `requestAnimationFrame`.

Tests live alongside source as `*.test.ts` and run with Vitest (`npm test` for watch mode, `npm run test:run` for a single run, `npm run coverage` for coverage).

## Architecture

- Plain TypeScript + Vite + Three.js, no framework. `tsconfig.json` uses strict bundler-mode settings: `verbatimModuleSyntax`, `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`. Relative imports are written **without** file extensions.

### Layers

Directories form a strict dependency order — each may only import from those below it. Keep it that way; it is what stopped `setup/` and `systems/` importing each other.

| Layer | Directory      | May import from                                               |
| ----- | -------------- | ------------------------------------------------------------- |
| 0     | `constants.ts` | nothing                                                       |
| 1     | `core/`        | constants, `three` types                                      |
| 2     | `utils/`       | constants, core **types only** — no `World` value, no `Scene` |
| 3     | `render/`      | constants, core                                               |
| 4     | `setup/`       | constants, core, utils, render                                |
| 5     | `systems/`     | constants, core, utils, render, setup                         |
| 6     | `main.ts`      | everything                                                    |

- **ECS core** (`src/core/`): `World` (`core/World.ts`) is a plain object of `Map<Entity, ...>` components (positions, blocks, flags, tags, paths/pathFollowers, ammo, position/scale/rotation tweens, scales, countdowns, renderables, queues, etc.) plus an `events` array and game `status` (`"playing" | "won" | "lost"`). `Entity` (`core/Entity.ts`) is just an auto-incrementing number — entities are pure IDs, all state lives in the World's component maps. `Tag.ts` provides a set-based tag/tagIndex component for ad hoc entity categorization, and `destroy.ts` is its sole "destroy"-tag writer. `Event.ts` is a simple push/consume event queue on the world, drained each frame by `clearEventsSystem`. `Grid.ts` and `Block.ts` hold the shared `Grid` and `BlockData` types, and `Flag.ts` holds `Flag` — the gameplay identity `shootingSystem` matches pawns to blocks on, kept deliberately separate from the palette an entity is drawn with.
- **Systems** (`src/systems/`): per-frame logic only. Each system is a function taking the `World` plus whatever it needs — signatures vary (`lifeSystem(world)`, `timerSystem(world, dt)`, `shootingSystem(world, grid, ctx)`), there is no shared `System` type. Concerns: `pathFollow` (entities following a `PathData` track), `shooting` (lane-based targeting and flag matching), `spawn`, `life` (lifes/damage; sole writer of `world.lifes`, and announces each applied change as a `life-changed` event), `lifePearl` (turns that event into a pearl animating off the shell, and tears it down when its scale tween ends), `destruction` (tag-driven entity teardown), `death` (a resolved pawn's spin/rise/shrink animation, and its teardown once it finishes), `garbageCollection` (removes destroyed entities' components/renderables), `timer`, `gameStatus` (win/loss detection), `clearEvents`. `main.ts`'s `animate()` loop calls these in a fixed order each frame. `systems/context.ts` defines the small `SystemContext` (scene + path entity) passed to systems that need scene access.
- **Rendering** (`src/render/`): everything Three.js-facing that isn't world construction — `renderSystem.ts` (syncs `Object3D`s and instance matrices from position/rotation/scale components; called from `animate()` even though it lives outside `systems/`), `renderable.ts` (`addRenderable`, the entity↔`Object3D` registration helper), `materials.ts` (the shared colour→material cache, plus the per-object material factories), `camera.ts`, `renderer.ts`, `interaction.ts` (raycast click handling, wired via `addEventListener` rather than the frame loop; sole producer of the `queue-clicked` event).
- **Setup/factories** (`src/setup/`): one-shot construction of entities/geometry — `grid.ts` (`makeGrid`, the block grid), `block.ts` (colored block entities), `pawn.ts` (shooter entities), `queue.ts` (waiting-pawn queues plus `createQueues`; `advanceQueue` is the tweened shuffle-up a queue does once a released pawn reaches the track), `projectile.ts` (fired shot entities), `track.ts` (`makePathAroundTheGrid`, plus `makeTrack` — the imported track mesh, scenery rather than an entity), `pearl.ts` (`makePearl`, the same kind of scenery: an un-instanced two-material mesh standing at the track's entrance, on an authored transform; `pearlBeadSource` derives the geometry/material/anchor the life pearls are spawned from), `lifePearl.ts` (`spawnLifePearl`, the short-lived pearls a life change throws off that bead), `debugPath.ts` (track visualizer), `meshEntity.ts` (`createMeshEntity`, the shared spawner shape), `ground.ts`/`light.ts` (static scene dressing).
- **Utils** (`src/utils/`): pure functions only — no `World`, no `Scene`. `gridMath.ts` has grid index/coordinate helpers (`toFlat`, `toRowColumn`, `cellToWorld`, `worldToLane`); `path.ts` has `roundCorners`, `locateSegment` and `samplePath`.

> `samplePath` (`utils/path.ts`) and `samplePositionTween` (`core/Tween.ts`) each return a **shared** module-level `Vector3` that the next call overwrites. Copy the result if you need to keep it. (`sampleScalarTween` returns a number, so it has no such caveat.)

- `constants.ts` centralizes tunable/derived values — grid size, camera framing (the camera is tilted, not top-down, and the frustum is derived algebraically to exactly frame the grid + track under a locked 9:16 aspect ratio), pawn speed/ammo, queue layout, spawn/projectile timing. Most camera and queue-position constants are _derived_ from a few source values rather than hardcoded — read the comments in `constants.ts` before changing any of them.
- Static assets referenced via import (e.g. `src/assets/*`) are processed/hashed by Vite; files in `public/` are served as-is and referenced by absolute path.
