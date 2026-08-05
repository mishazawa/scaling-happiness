# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

`src/` is still the unmodified Vite + TypeScript starter scaffold (`npm create vite`) — there is no game logic yet. `src/main.ts` renders the default Vite landing markup and `src/counter.ts` is the stock click-counter demo. Expect to replace both as the actual game is built.

The game design itself is specified in `GAME_RULES.md` (grid of colored blocks, a perimeter track, pawns with ammo that fire along lanes, a spawn queue, and a lives-refund mechanic). Read it before implementing gameplay systems — it is the source of truth for rules like when a pawn fires, how lives are spent/refunded, and win/lose conditions. `three` and `@types/three` are already installed as dependencies for the eventual renderer.

## Commands

```bash
npm run dev       # start Vite dev server with HMR
npm run build     # type-check (tsc, no emit) then production build via vite build
npm run preview   # serve the production build locally
```

There is no test runner, linter, or formatter configured. `tsc` type-checking runs only as part of `npm run build` (`tsconfig.json` has `"noEmit": true`); run `npx tsc` directly for a standalone type-check.

## Build/tooling architecture

- Plain TypeScript + Vite, no framework — `index.html` is the entry point and loads `src/main.ts` as an ES module.
- `src/main.ts` currently builds the page by assigning an HTML template string to `#app`'s `innerHTML`, then wires up behavior (currently `setupCounter` from `src/counter.ts`) by querying the DOM elements it just inserted. This scaffold code is a placeholder and will be replaced by the game bootstrap.
- Static assets referenced via import (e.g. `src/assets/*`) are processed/hashed by Vite; files in `public/` (e.g. `public/icons.svg`, `public/favicon.svg`) are served as-is and referenced by absolute path (`/icons.svg`).
- `tsconfig.json` uses strict bundler-mode settings: `verbatimModuleSyntax`, `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, and requires explicit `.ts` extensions on relative imports (`allowImportingTsExtensions`).

## Game architecture: Pure ECS / Data-Oriented Design

All game logic (everything implementing `GAME_RULES.md`) must follow a strict Entity-Component-System architecture in vanilla TypeScript. **No OOP for game logic**: no classes or inheritance for entities/components, no methods attached to state.

### Core types

- **Entity** = a plain number, no data or methods:
  ```ts
  type Entity = number;
  let nextEntityId = 0;
  const createEntity = (): Entity => nextEntityId++;
  ```
- **Component** = a plain data object (primitives, vectors) — no functions, no getters/setters. The one exception is Three.js objects (e.g. `Vector3`) where reusing the instance matters for performance. Pattern is a type + a factory function:
  ```ts
  type PositionData = Vector3;
  const Position = (x = 0, y = 0, z = 0): PositionData => new Vector3(x, y, z);
  ```
- **World** = a centralized store. Components are grouped by type in `Map<Entity, ComponentData>`:
  ```ts
  interface World {
    positions: Map<Entity, PositionData>;
    // all active component types go here
  }
  ```

### Systems

A System is a function that mutates `World` state.

- A System must never call another System.
- A System does not know what a "Pawn" or "Block" is — only combinations of components.
- A System must iterate the `Map` of its primary component, never all entities:
  ```ts
  function movementSystem(world: World, dt: number) {
    for (const [entity, vel] of world.velocities) {
      const pos = world.positions.get(entity);
      if (!pos) continue; // secondary lookup
      pos.x += vel.x * dt;
    }
  }
  ```

### Entity composition (factories)

Entities are built by functional composition, not classes: generate an id, then inject data directly into the World's maps, returning only the id:

```ts
function spawnPawn(world: World, color: Color, ammo: number): Entity {
  const e = createEntity();
  world.positions.set(e, Position(...));
  world.pawns.set(e, { color, ammo });
  return e;
}
```

### Rendering & side effects

- Rendering (Three.js) is a downstream, read-only System (`renderSystem`) — it reads the ECS World and syncs transforms to `THREE.Mesh` objects by entity id. The logic tick and render tick are decoupled in state.
- Delayed side effects (spawning/destroying entities — e.g. a pawn completing a lap, or a block being destroyed) should use tag components or timer systems rather than mutating maps while iterating them.

### Adding a new feature (workflow)

1. **Define the data** — new component interface + factory function.
2. **Register the component** — add its `Map<Entity, ComponentData>` to `World` and `createWorld()`.
3. **Define the logic** — a pure function System iterating the new map.
4. **Register the system** — add it to the main loop in the correct execution order (e.g. compute damage before checking death; move pawns before checking lane hits).
5. **Compose** — attach the component to relevant entities in factory setup.

### Anti-patterns (do not generate)

- `class Pawn extends Entity` or any class/inheritance for game state.
- Methods attached to entities/components (`entity.update()`).
- Storing Entity references inside other components where a shared resource id or relational tag would do.
- `world.entities.forEach(...)` to check for components — always iterate a specific component `Map`.
- Input listeners embedded directly inside systems — systems read from a shared input state object passed in.
