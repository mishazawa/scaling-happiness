# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

This is currently the unmodified Vite + TypeScript starter scaffold (`npm create vite`) despite the `shooter-game` name — there is no game logic yet. `src/main.ts` renders the default Vite landing markup and `src/counter.ts` is the stock click-counter demo. Expect to replace both as the actual game is built. Not a git repository yet.

## Commands

```bash
npm run dev       # start Vite dev server with HMR
npm run build     # type-check (tsc, no emit) then production build via vite build
npm run preview   # serve the production build locally
```

There is no test runner, linter, or formatter configured. `tsc` type-checking runs only as part of `npm run build` (`tsconfig.json` has `"noEmit": true`); run `npx tsc` directly for a standalone type-check.

## Architecture

- Plain TypeScript + Vite, no framework — `index.html` is the entry point and loads `src/main.ts` as an ES module.
- `src/main.ts` builds the page by assigning an HTML template string to `#app`'s `innerHTML`, then wires up behavior (currently `setupCounter` from `src/counter.ts`) by querying the DOM elements it just inserted.
- Static assets referenced via import (e.g. `src/assets/*`) are processed/hashed by Vite; files in `public/` (e.g. `public/icons.svg`, `public/favicon.svg`) are served as-is and referenced by absolute path (`/icons.svg`).
- `tsconfig.json` uses strict bundler-mode settings: `verbatimModuleSyntax`, `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, and requires explicit `.ts` extensions on relative imports (`allowImportingTsExtensions`).
