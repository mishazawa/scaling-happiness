import {
  OrthographicCamera,
  Scene,
  Timer,
  Vector3,
  WebGLRenderer,
} from "three";
import "./style.css";
import {
  BLOCK_SIZE,
  CAMERA_FRUSTUM_SIZE,
  CAMERA_POSITION,
  GRID_COLUMNS,
  GRID_ROWS,
} from "./constants";
import { setupLight } from "./setup/light";
import { setupGround } from "./setup/ground";
import { makeGrid } from "./utils/grid";
import { createEntity } from "./core/Entity";
import { createWorld } from "./core/World";
import { renderSystem } from "./systems/render";
import { pathFollowSystem } from "./systems/pathFollow";
import { timerSystem } from "./systems/timer";
import { shootingSystem } from "./systems/shooting";
import { handlePointerClick } from "./systems/interaction";
import { spawnSystem } from "./systems/spawn";
import { lifeSystem } from "./systems/life";
import { garbageCollectionSystem } from "./systems/garbageCollection";
import { destructionSystem } from "./systems/destruction";
import { clearEventsSystem } from "./systems/clearEvents";
import { gameStatusSystem } from "./systems/gameStatus";
import type { SystemContext } from "./systems/context";
import { DEBUG_pathVisualizer, makePathAroundTheGrid } from "./utils/path";
import { createQueues } from "./utils/queue";

function updateCameraFrustum(camera: OrthographicCamera) {
  const aspect = window.innerWidth / window.innerHeight;
  const halfHeight = CAMERA_FRUSTUM_SIZE / 2;
  const halfWidth = halfHeight * aspect;

  camera.left = -halfWidth;
  camera.right = halfWidth;
  camera.top = halfHeight;
  camera.bottom = -halfHeight;
  camera.near = 0.1;
  camera.far = 1000;
  camera.updateProjectionMatrix();
}

const GRID_PARAMETERS = {
  columns: GRID_COLUMNS,
  rows: GRID_ROWS,
  cellSize: BLOCK_SIZE,
  center: new Vector3(0, 0, 0),
};

function main() {
  const container = document.querySelector<HTMLDivElement>("#app")!;
  const endScreen = document.querySelector<HTMLDivElement>("#end-screen")!;
  const endScreenMessage = document.querySelector<HTMLHeadingElement>(
    "#end-screen-message",
  )!;
  const repeatButton =
    document.querySelector<HTMLButtonElement>("#repeat-game")!;

  const clock = new Timer();
  const scene = new Scene();
  const camera = new OrthographicCamera();
  camera.position.set(...CAMERA_POSITION);
  camera.lookAt(0, 0, 0);
  updateCameraFrustum(camera);

  setupLight(scene);
  setupGround(scene);

  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  container.appendChild(renderer.domElement);

  window.addEventListener("resize", () => {
    updateCameraFrustum(camera);
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  let world = createWorld();
  let ctx: SystemContext;

  function initGame() {
    for (const object3D of world.renderables.values()) {
      scene.remove(object3D);
    }

    world = createWorld();

    makeGrid(world, scene, GRID_PARAMETERS);
    const pd = makePathAroundTheGrid(GRID_PARAMETERS, 1);
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
