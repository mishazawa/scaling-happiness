# Phase 1

Wrote the game rules first, then built an entity/component/systems stubs, to make the agent aware what style to use. Then passed ECS framework rules and asked to complete/implement stubs.

I've tried to allow Claude to build whole game just using rules + screenshot. It makes prototype, but very far from what is expected.

At the beginning I wanted to ressemble MonoBehavior type of components, to make a declarative scene like R3F, but ECS seems to be easier to navigate and whole scene is just 2-3 loops (grid, queues, projectiles), so no actual reason for declarative scene.

Typical workflow was: make couple of stubs -> describe the idea -> let the agent implement the code. I wanted to be able understand structure of project while agent working on code and be able to made manual changes at any time.

I've tried to move as much as possible parameters to the constants, for fast configuration.

Order of tasks:

1. Grid, because it allows immediate test of ecs + rendering system
2. Path; I started from simple 4 point movement.
3. Added playable entities (I called them "pawns" (checkerboard pattern, btw)). Added tags for click detection. Make them move along path and queue.
4. Added events and garbage collecting system to remove pawns at the end of path.
5. Shooting system. I don't want to use ray casting, then I tried to figure out the way to match lanes to current position on the path. Added matching by color and destruction of blocks.
6. Implemented ammo counting. It was last stub I put to codebase.

At this moment Claude was able to infer patterns and style from codebase and produce simple understandable code.

7. Lifes counter and win/lose state.
8. Tween system for animated transitions.
9. Added projectiles.
10. Command agent to adjust scene to 9:16 aspect ration, using screenshot. Put several values to constants to be able to adjust framing.
11. Added smooth corners to path. Tried to not use heavy math in sampling position on path.

# Phase 2

On second phase I wanted to implement configurable look with encoded palette into data texture, assign an attibute to mesh in DCC and use in 3js.
Also I wanted automatic track generation using points from constants. Claude made a script which makes spline in blender and geo nodes sweep the profile with UVs. Btw, I made some manual changes afterwards, like caps for track and geo cleanup (planar useless polys).

Playable objects (Fish and grid) implemented as Instanced mesh and share the same material. Kind of overkill, but allow to configure palette in runtime and in theory it allow to run thousands of instances. With parameters BLOCK_SIZE = 0.1 GRID_COLUMNS = 100 (100x100x2 of blocks) it is playable-ish on mobile...
// room for imrovement: make projectiles instanced

Steps:

12. Run structural refactoring, because some util functions was written in core and vise verse. Purpose of events and tag was not clear. Dedupe.
13. Added fish model.
14. Implemented palette and instanced meshes.
15. Decouple color from matching logic.
16. Added rotation for moving pawn to match reference.
17. Added tween animations for dying entities.
18. Added tween animation to queue.
19. Added track mesh. Fighting UV warping on turns.
20. Added shell and pearls.
21. Hook shaders to add "caustics" look.
22. Added easing to tweens.
