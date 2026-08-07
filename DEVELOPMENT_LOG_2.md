# Development Log, Part 2

Picks up exactly where `DEVELOPMENT_LOG.md` stops — the last thing it records is
the smooth-track-corners work (`roundCorners`, Step 15). Everything below happens
after that, over 2026-08-06 → 2026-08-07, and is reconstructed from the git
history.

The rhythm changed here. Part 1 was *build the rules into existence*: stub,
implement, test, wire up. Part 2 is two different things braided together — a
sweeping **structural cleanup** that turned an organically grown `src/` into the
layered dependency order the project now enforces, and then a long **art and
feel pass**: authored models, a palette shader, instanced rendering, animation,
and water.

---

## Step 16 — Delete what nothing uses

The first act after writing Part 1 was subtraction:

- `spawnProjectile` still took a `color` parameter no caller depended on.
- `systems/movement.ts`, its test, and `systems/system.ts` (the old
  `System` type) were all dead — the movement stub had been superseded by
  `pathFollow`, and system signatures had long since diverged from one shared
  type. All three were deleted rather than kept "just in case".

That last deletion is why the project has no `System` type today: systems are
just functions whose signatures vary (`lifeSystem(world)`,
`timerSystem(world, dt)`, `shootingSystem(world, grid, ctx)`).

## Step 17 — The layering pass

This is the largest structural change in the project's life, done as a run of
small, individually reviewable moves. It is what produced the layered table now
documented in `CLAUDE.md`.

1. **Types down into `core/`.** `Grid`, `BlockData` and `destroy` moved out of
   `setup/` into `core/`. Factories were importing types from each other; now
   the shared vocabulary lives at the bottom of the stack where everything may
   reach it.
2. **A `render/` layer, breaking the `setup/` ↔ `systems/` cycle.** This was the
   real problem: `setup/` factories needed to add objects to the scene, and
   `systems/render.ts` needed to know about the objects factories made. The fix
   was a new layer that is neither: `render/renderable.ts` (`addRenderable`),
   `render/renderSystem.ts`, and `render/interaction.ts` (moved out of
   `systems/`, since it is raycast click handling wired to `addEventListener`,
   not a per-frame system). The cycle disappeared.
3. **World construction out of `utils/`.** `utils/` was quietly holding things
   that build entities. `setup/grid.ts`, `setup/track.ts` (with its own tests),
   `setup/debugPath.ts` and the queue layout all moved into `setup/`, leaving
   `utils/` genuinely pure — no `World` value, no `Scene`.
4. **`utils/index.ts` → `utils/gridMath.ts`,** then the grid-origin and lane math
   that `grid.ts` and `shooting.ts` had each been computing inline was extracted
   into it (`toFlat`, `toRowColumn`, `cellToWorld`, `worldToLane`).
5. **One material cache instead of three.** `block.ts`, `pawn.ts` and
   `projectile.ts` each carried their own colour→material map. Collapsed into
   `render/materials.ts`, with a comment explaining why it is deliberately never
   cleared or disposed: a restart tears the scene down while those materials are
   still referenced by the objects being removed.
6. **The palette got a name** in `constants.ts` instead of hex literals scattered
   across three factories.
7. **Camera and renderer construction** left `main.ts` for `render/camera.ts` and
   `render/renderer.ts`, cutting `main.ts` roughly in half.
8. **One segment walk, two samplers.** The open-path and closed-path samplers in
   `utils/path.ts` had duplicated the arc-length walk; `locateSegment` became the
   shared piece.
9. **`createMeshEntity`** absorbed the identical spawner shape that `block.ts`,
   `pawn.ts` and `projectile.ts` had each written out longhand.

`CLAUDE.md` was then rewritten to document the resulting layout and, crucially,
the **dependency order** — `constants` → `core` → `utils` → `render` → `setup` →
`systems` → `main` — so the cycle that was just removed cannot come back by
accident.

## Step 18 — Real models enter the project

Up to this point every entity was a primitive. This step brought in an art
pipeline:

- Blender sources committed under `models/`, exporting glTF into `src/assets/`.
- `setup/assets.ts` — an async loader keyed by a manifest declared in `main.ts`,
  awaited before the scene is built.
- `src/vite-env.d.ts` — module declarations so `import FISH_MESH from
  "./assets/fish.glb"` typechecks.
- The Vite starter leftovers (`hero.png`, `typescript.svg`, `vite.svg`) were
  finally deleted.

`main()` became `async` here, which is the small structural consequence that
shaped everything after it: assets are loaded, *then* the world is built.

## Step 19 — Palette as a texture, and instanced meshes

The biggest single change in this range, and the one the rendering still rests
on.

**The palette shader.** `utils/paletteTexture.ts` packs every palette into an
RGBA lookup texture — one palette per row, one colour slot per column. Vertices
carry a `_color_id` attribute authored in Blender, which is how a single fish
mesh shows four colour regions with no per-entity material. Per instance, the
shader is told *which row* to read. The tricky part, documented at the packer:
the bytes are raw sRGB hex, and marking the texture `SRGBColorSpace` makes three
upload it as `SRGB8_ALPHA8`, so sampling already yields linear-light values —
the shader must **not** convert again, or the palette drifts away from anything
built with `standardMaterial({ color })`.

**Instancing.** `render/modelRegistry.ts` merges a loaded glTF scene into a
single geometry and hands back an `InstancedMesh` plus two per-instance
attributes: the palette `row`, and a `phase` offset so instances don't breathe
in sync. The registry deliberately lives *outside* the ECS world — these are GPU
resources shared by every entity of a model, and they have to survive the world
rebuild that a restart performs. `renderSystem` repacks instance slots from
scratch each frame, which means a restart clears them with no teardown code at
all.

**`utils/geometry.ts`** appeared to support this: `tagColorSlot` stamps one
colour slot across procedural geometry that has no authored tagging, and
`prepareGeometry` normalizes a loaded model into instancing-ready form.

`main.ts` now registers models once at startup and adds their meshes to the
scene once, outside `initGame`.

## Step 20 — Colour is not identity

With colour now a *palette slot*, the gameplay rule that a pawn shoots
"matching" blocks could no longer be phrased in terms of the colour an entity is
drawn with. `core/Flag.ts` introduced `Flag` — the gameplay identity
`shootingSystem` matches on — kept deliberately separate from the palette used
to render. Hardcoded colour comparisons came out of the shooting logic, and the
test suite was reworked across roughly every system to speak in flags.

A follow-up pass repaired and extended the tests, and moved more magic numbers
into `constants.ts`.

## Step 21 — Rotation and facing

Pawns had been sliding around the track without ever turning.

- `core/Rotation.ts` — a yaw component plus the angle math: `yawFromDirection`,
  `axisYawFromDirection`, `normalizeAngle`, `shortestAngleDelta`, and
  `stepAngle`, which moves an angle toward a target at a rate rather than
  snapping it.
- `systems/facing.ts` — the rule, and it is a one-way door. Before its first
  shot, a pawn faces the **track tangent**, so it swims the way it travels and
  leans through corners. From its first shot onward (the "aiming" tag, set by
  `shootingSystem`) it faces the **field**, recomputed every frame from where it
  now stands and snapped to a major axis — so rounding a corner onto a new side
  re-aims it instead of leaving it holding the old side's angle.
- `samplePathDirection` was added to `utils/path.ts` to supply the tangent.
- A direction swap followed, flipping which way pawns travel the track.

`facingSystem` runs after `shootingSystem` (which sets the aim) and before
rendering (which draws the yaw), so a turn is never a frame behind its cause.

## Step 22 — Death: spin, rise, shrink

A resolved pawn used to simply vanish. Now it performs.

- `core/Scale.ts` and scalar tweens: `core/Tween.ts` grew a `ScalarTweenData`
  shape shared by scale *and* yaw, each in its own `world.xTweens` map so every
  tick loop stays branch-free. Only the `Vector3` case earns its own type.
- `systems/death.ts` — starts the spin/rise/shrink on a resolved pawn and tears
  the entity down once the animation finishes. The scale tween is the
  animation's clock.
- `timerSystem` was extended to tick the new tween maps, `renderSystem` to apply
  scale and rotation, and `garbageCollectionSystem` to clear the new components.

## Step 23 — The queue comes alive

The waiting line stopped being static: `advanceQueue` became a tweened
shuffle-up performed once a released pawn reaches the track, and the queue's
layout constants moved into `constants.ts`. Later in the range, queued pawns
were also made to sit **larger** than life and tween back to scale 1 as they
arrive on the track — a size cue that says "this one is next" without any UI.

## Step 24 — The track becomes a model

The track had been an invisible mathematical path with a debug visualizer. It
became a real object:

- `models/make_track_curve.py` — a Blender-side generator, committed so the
  track mesh is reproducible from parameters rather than being an opaque blob.
- `track.glb` imported and placed as **scenery**, not an entity: it exists once,
  never moves, has no per-frame state, and carries two different materials
  across its halves — which one merged instanced geometry could not express.
- Then it was made to *move*. A scrolling belt texture runs along the track to
  show direction of travel. Making that work needed `uvBand` and `uvLengthU` in
  `utils/geometry.ts`: a model exported with one shared UV layout gives each part
  only a slice of `v` (the belt's band is about 0.04 tall), so the texture has to
  be stretched onto that measured band. Measured from the export rather than
  hardcoded, precisely so re-exporting the model can't silently break it.
- Lighting parameters were reworked alongside it.

## Step 25 — The pearl, and a life counter you can see

- `setup/pearl.ts` — an imported pearl mesh standing at the mouth of the track,
  the point every pawn spawns from. Scenery on exactly the same terms as the
  track, and un-instanced for the same reason: its two halves (`shell`, gold and
  metallic; `pearl`, a glossy dielectric bead) need two materials. Its position
  and scale are authored, not derived.
- `setup/lifePearl.ts` + `systems/lifePearl.ts` — the life count is now *played
  out* at that shell. A life spent sends a pearl rising, spinning and shrinking
  out of the shell; a life refunded is the same three tweens read backwards —
  falling in from above, counter-spinning, growing from nothing. The refund
  lands concentric with the standing bead and strictly smaller than it, so the
  bead hides its removal exactly, with no fade distance tuned by eye.
- One pearl per frame in which the count moved, whichever way and however far:
  the shell reads as *a place lifes come from*, not as a tally, so two lifes lost
  to one frame's clicks is still one thing happening.
- The bead the pearls copy is passed into the system as a `LifePearlSource`
  rather than looked up — it is scenery built once at startup, outside the ECS
  and outside the restart rebuild, and reaching into the model registry from a
  system would force every test to load a model.
- `lifeSystem` now emits a `life-changed` event carrying a delta, which is what
  the pearl system reads.

`lifePearlSystem` is ordered immediately after `lifeSystem` and before
rendering, so a life spent is drawn leaving the shell on the very frame it was
spent.

## Step 26 — Caustics

The underwater look.

- `tools/makeCausticTexture.mjs` bakes `src/assets/caustics.png` offline, run by
  hand; nothing imports it and nothing runs it at boot. It exists so the
  committed binary is reproducible and tunable instead of opaque. The tile is
  periodic *by construction* — value noise on a lattice taken modulo its own
  size, at octave sizes that all divide the image — rather than by blending
  edges. Ridging the noise turns its mid-level contour into the connected
  filaments caustics actually have.
- Deliberately baked **softer** than the final look: `withCaustics` multiplies
  two scrolling, differently-drifting copies of the tile, and that product is
  what sharpens the filaments. Bake it sharp and the product is sparse dots
  instead of lines.
- Applied to the ground first, then extended to the track and the pearl's shell.
- `setCausticTexture` is called in `main()` before anything that draws with
  caustics is built — the uniform is shared by reference, so a later material
  would pick the tile up anyway, but the ground is built in the very next lines
  and a frame drawn with a null sampler is a frame with no caustics on it.

Two side branches (`worktree-life-pearl-feedback`, `worktree-queue-pawn-scale`)
were merged back around here, and the life-pearl placement was tuned afterwards.

## Step 27 — Feel and housekeeping

- **Tween easing.** Every tween shape gained an explicit `easing` key selected
  from a small `Easing` table, and the existing call sites — projectile, queue
  shuffle, spawn, death, life pearl — were each given a curve instead of linear
  motion.
- **Game-loop reorder.** `timerSystem` moved to the top of the frame, and
  `renderSystem`, `garbageCollectionSystem`, `gameStatusSystem` and the
  end-screen check moved *outside* the `status === "playing"` guard. Tweens and
  rendering therefore keep running once the round resolves, rather than the
  final frame freezing mid-animation.
- **`tools/logs.py`** — a small offline script that extracts the user side of
  saved AI transcripts, with `.gitignore` updated for the log directory.
- Unused assets removed, and a final pass repairing the test suite after the
  easing and pearl changes (`Tween`, `interaction`, `lifePearl`, `pearl`,
  `death`, `facing`, `garbageCollection`, `timer`).

---

## Current state

**Frame pipeline** (`animate()` in `src/main.ts`):

```
timerSystem                                  ← always, even after the round ends

if (status === "playing"):
  pathFollowSystem → shootingSystem → destructionSystem → deathSystem
  → spawnSystem → lifeSystem → lifePearlSystem → facingSystem

if (status !== "playing"): showEndScreen()

renderSystem → garbageCollectionSystem → gameStatusSystem → clearEventsSystem
→ renderer.render()
```

**Layout**

| Directory | Role |
|---|---|
| `src/constants.ts` | Tunables plus algebraically derived camera/queue/shader values |
| `src/core/` | `World`, `Entity`, and components — Position, Path, Queue, Ammo, Tween, Countdown, Rotation, Scale, Renderable, Tag, Event, Flag, Grid, Block, Model, `destroy` |
| `src/utils/` | Pure functions only: `gridMath`, `path`, `geometry`, `paletteTexture` |
| `src/render/` | Everything Three.js-facing that isn't construction: `renderSystem`, `renderable`, `materials`, `modelRegistry`, `camera`, `renderer`, `interaction` |
| `src/setup/` | One-shot factories: `grid`, `block`, `pawn`, `queue`, `projectile`, `track`, `pearl`, `lifePearl`, `meshEntity`, `assets`, `ground`, `light`, `debugPath` |
| `src/systems/` | One function per concern: `pathFollow`, `shooting`, `facing`, `spawn`, `life`, `lifePearl`, `death`, `destruction`, `garbageCollection`, `timer`, `gameStatus`, `clearEvents` |
| `models/`, `tools/` | Blender sources, the track generator, and offline bakers — none of it runs at boot |

Imports respect a strict one-way dependency order down that table, and are
written **without** file extensions.

**Testing** — Vitest, colocated as `*.test.ts`: `npm test` (watch) ·
`npm run test:run` (single run) · `npm run coverage`. No dev servers, no smoke
tests; the linter and the suite are the check.

**Stack** — TypeScript, Vite, Three.js, Vitest, under a strict bundler-mode
`tsconfig` (`verbatimModuleSyntax`, `noUnusedLocals`, `noUnusedParameters`,
`erasableSyntaxOnly`).
