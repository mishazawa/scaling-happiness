import { Scene, Timer, Vector3 } from "three";
import "./style.css";
import {
  BLOCK_SIZE,
  GRID_COLUMNS,
  GRID_ROWS,
  TRACK_PADDING,
} from "./constants";
import { setupLight } from "./setup/light";
import { setupGround } from "./setup/ground";
import { makeGrid } from "./setup/grid";
import { createEntity } from "./core/Entity";
import { createWorld } from "./core/World";
import { renderSystem } from "./render/renderSystem";
import { pathFollowSystem } from "./systems/pathFollow";
import { timerSystem } from "./systems/timer";
import { shootingSystem } from "./systems/shooting";
import { handlePointerClick } from "./render/interaction";
import { spawnSystem } from "./systems/spawn";
import { lifeSystem } from "./systems/life";
import { garbageCollectionSystem } from "./systems/garbageCollection";
import { destructionSystem } from "./systems/destruction";
import { clearEventsSystem } from "./systems/clearEvents";
import { gameStatusSystem } from "./systems/gameStatus";
import type { SystemContext } from "./systems/context";
import { makePathAroundTheGrid } from "./setup/track";
import { DEBUG_pathVisualizer } from "./setup/debugPath";
import { createQueues } from "./setup/queue";
import { createCamera, updateCameraFrustum } from "./render/camera";
import { createRenderer } from "./render/renderer";
import { loadAssets, type AssetId } from "./setup/assets";

import FISH_MESH from "./assets/fish.glb";

export const MANIFEST: Record<AssetId, string> = {
  pawn: FISH_MESH,
};

async function main() {
  const GRID_PARAMETERS = {
    columns: GRID_COLUMNS,
    rows: GRID_ROWS,
    cellSize: BLOCK_SIZE,
    center: new Vector3(0, 0, 0),
  };

  const container = document.querySelector<HTMLDivElement>("#app")!;
  const endScreen = document.querySelector<HTMLDivElement>("#end-screen")!;
  const endScreenMessage = document.querySelector<HTMLHeadingElement>(
    "#end-screen-message",
  )!;
  const repeatButton =
    document.querySelector<HTMLButtonElement>("#repeat-game")!;

  await loadAssets(MANIFEST);

  const clock = new Timer();
  const scene = new Scene();
  const camera = createCamera(container);

  setupLight(scene);
  setupGround(scene);

  const renderer = createRenderer(container);

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

    makeGrid(world, scene, GRID_PARAMETERS);
    const pd = makePathAroundTheGrid(GRID_PARAMETERS, TRACK_PADDING);
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
      spawnSystem(world, ctx);
      lifeSystem(world);

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
