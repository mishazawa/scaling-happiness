import { Scene, Timer, Vector3 } from "three";
import "./style.css";
import {
  BLOCK_CAPACITY,
  BLOCK_MODEL_RADIUS,
  BLOCK_SIZE,
  DARK_PALETTE_SLOT,
  GRID_COLUMNS,
  GRID_ROWS,
  LIGHT_PALETTE_SLOT,
  PAWN_CAPACITY,
  PAWN_MODEL_RADIUS,
} from "./constants";
import { setupLight } from "./setup/light";
import { setupGround } from "./setup/ground";
import { makeGrid } from "./setup/grid";
import { makeBubbleMesh } from "./setup/block";
import { createEntity } from "./core/Entity";
import { createWorld } from "./core/World";
import { renderSystem } from "./render/renderSystem";
import { pathFollowSystem } from "./systems/pathFollow";
import { timerSystem } from "./systems/timer";
import { shootingSystem } from "./systems/shooting";
import { facingSystem } from "./systems/facing";
import { handlePointerClick } from "./render/interaction";
import { spawnSystem } from "./systems/spawn";
import { lifeSystem } from "./systems/life";
import { garbageCollectionSystem } from "./systems/garbageCollection";
import { destructionSystem } from "./systems/destruction";
import { deathSystem } from "./systems/death";
import { clearEventsSystem } from "./systems/clearEvents";
import { gameStatusSystem } from "./systems/gameStatus";
import type { SystemContext } from "./systems/context";
import { makePathAroundTheGrid, makeTrack } from "./setup/track";
import { makePearl } from "./setup/pearl";
import { DEBUG_pathVisualizer } from "./setup/debugPath";
import { createQueues } from "./setup/queue";
import { createCamera, updateCameraFrustum } from "./render/camera";
import { createRenderer } from "./render/renderer";
import {
  getAssetById,
  getTextureById,
  loadAssets,
  loadTextures,
  type AssetId,
  type TextureId,
} from "./setup/assets";
import { registerModel } from "./render/modelRegistry";
import { setCausticTexture } from "./render/materials";

import FISH_MESH from "./assets/fish.glb";
import TRACK_MESH from "./assets/track.glb";
import PEARL_MESH from "./assets/pearl.glb";
import ARROW_TEXTURE from "./assets/water.png";
import CAUSTICS_TEXTURE from "./assets/caustics.png";
import type { Grid } from "./core/Grid";

export const MANIFEST: Record<AssetId, string> = {
  pawn: FISH_MESH,
  track: TRACK_MESH,
  pearl: PEARL_MESH,
};

export const TEXTURE_MANIFEST: Record<TextureId, string> = {
  arrow: ARROW_TEXTURE,
  caustics: CAUSTICS_TEXTURE,
};

async function main() {
  const GRID_PARAMETERS: Grid = {
    columns: GRID_COLUMNS,
    rows: GRID_ROWS,
    cellSize: BLOCK_SIZE,
    center: new Vector3(0, 0, 0),
    palette: [LIGHT_PALETTE_SLOT, DARK_PALETTE_SLOT],
  };

  const container = document.querySelector<HTMLDivElement>("#app")!;
  const endScreen = document.querySelector<HTMLDivElement>("#end-screen")!;
  const endScreenMessage = document.querySelector<HTMLHeadingElement>(
    "#end-screen-message",
  )!;
  const repeatButton =
    document.querySelector<HTMLButtonElement>("#repeat-game")!;

  await Promise.all([loadAssets(MANIFEST), loadTextures(TEXTURE_MANIFEST)]);

  // Before anything that draws with caustics is built. Materials patched later
  // would pick the tile up anyway — the uniform is shared by reference — but
  // the ground below is built in the very next lines, and a frame drawn with a
  // null sampler is a frame with no caustics on it.
  setCausticTexture(getTextureById("caustics"));

  const clock = new Timer();
  const scene = new Scene();
  const camera = createCamera(container);

  setupLight(scene);
  setupGround(scene);

  const renderer = createRenderer(container);

  // Registered and added to the scene once, outside initGame: an instanced mesh
  // is a rendering resource shared by every entity of its model, not world
  // state. The render system repacks the slots from zero each frame, so a
  // restart clears them with no teardown.
  scene.add(
    registerModel(
      "pawn",
      getAssetById("pawn"),
      PAWN_CAPACITY,
      PAWN_MODEL_RADIUS,
    ).mesh,
    registerModel("block", makeBubbleMesh(), BLOCK_CAPACITY, BLOCK_MODEL_RADIUS)
      .mesh,
    // Not instanced: the track exists once, never moves, and its two halves
    // carry two different materials. See `makeTrack`.
    makeTrack(getAssetById("track"), getTextureById("arrow")),
    // Scenery too, and for the same reasons. It stands at the mouth of the
    // track — the point every pawn is spawned onto.
    makePearl(getAssetById("pearl")),
  );

  function handleResize() {
    updateCameraFrustum(camera, container);
    renderer.setSize(container.clientWidth, container.clientHeight);
  }

  window.addEventListener("resize", handleResize);
  new ResizeObserver(handleResize).observe(container);

  let world = createWorld();
  let ctx: SystemContext;

  function initGame() {
    for (const object3D of world.renderables.values()) {
      scene.remove(object3D);
    }

    world = createWorld();

    makeGrid(world, GRID_PARAMETERS);
    const pd = makePathAroundTheGrid();
    const pathEntity = createEntity();
    world.paths.set(pathEntity, pd);

    DEBUG_pathVisualizer(world, pd, scene);

    createQueues(world, scene);

    ctx = { scene, pathEntity };
    endScreen.classList.add("hidden");
  }
  initGame();

  repeatButton.addEventListener("click", () => {
    initGame();
  });

  renderer.domElement.addEventListener("click", (event) => {
    if (world.status !== "playing") return;
    handlePointerClick(world, camera, renderer.domElement, event);
  });

  function showEndScreen() {
    endScreenMessage.textContent =
      world.status === "won" ? "You win!" : "Game over";
    endScreen.classList.remove("hidden");
  }
  function animate() {
    requestAnimationFrame(animate);
    const dt = clock.getDelta();

    if (world.status === "playing") {
      pathFollowSystem(world, dt);
      shootingSystem(world, GRID_PARAMETERS, ctx);
      timerSystem(world, dt);
      destructionSystem(world);
      // Paired with destructionSystem: both turn a finished tween into a
      // teardown. After the two systems that resolve pawns and after
      // timerSystem, which is what completes the animation deathSystem starts.
      deathSystem(world);
      spawnSystem(world, ctx);
      lifeSystem(world);
      // After shooting (which sets the aim) and before rendering (which draws
      // the yaw), so a turn is never a frame behind what caused it.
      facingSystem(world, GRID_PARAMETERS, dt);

      renderSystem(world, dt);
      garbageCollectionSystem(world, ctx);
      gameStatusSystem(world);

      if (world.status !== "playing") showEndScreen();
    }

    clearEventsSystem(world);
    renderer.render(scene, camera);
    clock.update();
  }
  animate();
}

main();
