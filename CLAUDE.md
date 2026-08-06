# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

A working game, built on Three.js with a hand-rolled ECS. Pawns of different colors queue up, spawn onto a track that loops around a grid of colored blocks, and shoot color-matched blocks off the grid as they path around it; losing all lifes or clearing the grid ends the round. `index.html` hosts `#app` (the WebGL canvas mount) and an `#end-screen` overlay with a repeat button. `src/main.ts` is the entry point: it sets up the Three.js scene/camera/renderer, builds the world, and drives the per-frame system pipeline via `requestAnimationFrame`.

Tests live alongside source as `*.test.ts` and run with Vitest (`npm test` for watch mode, `npm run test:run` for a single run, `npm run coverage` for coverage).

## Architecture

- Plain TypeScript + Vite + Three.js, no framework. `tsconfig.json` uses strict bundler-mode settings: `verbatimModuleSyntax`, `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, and requires explicit `.ts` extensions on relative imports (`allowImportingTsExtensions`).
- **ECS core** (`src/core/`): `World` (`core/World.ts`) is a plain object of `Map<Entity, ...>` components (positions, blocks, colors, tags, paths/pathFollowers, ammo, position tweens, countdowns, renderables, queues, etc.) plus a `events` array and game `status` (`"playing" | "won" | "lost"`). `Entity` (`core/Entity.ts`) is just an auto-incrementing number — entities are pure IDs, all state lives in the World's component maps. `Tag.ts` provides a set-based tag/tagIndex component for ad hoc entity categorization. `Event.ts` is a simple push/consume event queue on the world, drained each frame by `clearEventsSystem`.
- **Systems** (`src/systems/`): each system is a function `(world, dt?, args?) => void` (see `systems/system.ts`) that reads/writes World component maps for one concern — `movement`, `pathFollow` (entities following a `PathData` track), `shooting` (lane-based targeting and color matching), `spawn`, `life` (lifes/damage), `destruction` (tag-driven entity teardown), `garbageCollection` (removes destroyed entities' components/renderables), `render` (syncs Three.js `Object3D`s from position components), `timer`, `gameStatus` (win/loss detection), `clearEvents`. `main.ts`'s `animate()` loop calls these in a fixed order each frame. `systems/context.ts` defines the small `SystemContext` (scene + path entity) passed to systems that need scene access.
- **Setup/factories** (`src/setup/`): one-shot construction of entities/geometry — `grid.ts` (the block grid), `block.ts` (colored block entities), `pawn.ts` (shooter entities), `queue.ts` (waiting-pawn queues), `projectile.ts` (fired shot entities), `destroy.ts` (marks entities for teardown via tag), `ground.ts`/`light.ts` (static scene dressing).
- **Utils** (`src/utils/`): `path.ts` builds the track (`makePathAroundTheGrid`) the pawns follow and a debug visualizer; `grid.ts` builds the block grid layout; `queue.ts` builds the pawn queues; `index.ts` has small shared helpers (e.g. `toFlat` for row/column ↔ flat-index conversion).
- `constants.ts` centralizes tunable/derived values — grid size, camera framing (the camera is tilted, not top-down, and the frustum is derived algebraically to exactly frame the grid + track under a locked 9:16 aspect ratio), pawn speed/ammo, queue layout, spawn/projectile timing. Most camera and queue-position constants are *derived* from a few source values rather than hardcoded — read the comments in `constants.ts` before changing any of them.
- Static assets referenced via import (e.g. `src/assets/*`) are processed/hashed by Vite; files in `public/` are served as-is and referenced by absolute path.
