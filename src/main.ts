import {
  Object3D,
  OrthographicCamera,
  Scene,
  Timer,
  WebGLRenderer,
} from "three";
import "./style.css";
import { CAMERA_POSITION } from "./constants";
import { setupLight } from "./setup/light";
import { createWorld } from "./core/World";
import type { Entity } from "./core/Entity";
import { renderSystem } from "./systems/render";

function main() {
  const container = document.querySelector<HTMLDivElement>("#app")!;

  const clock = new Timer();
  const scene = new Scene();
  const camera = new OrthographicCamera();
  camera.position.set(...CAMERA_POSITION);
  camera.lookAt(0, 0, 0);

  setupLight(scene);

  const renderer = new WebGLRenderer({ antialias: true });
  // complete renderer setup
  // add resize event handler

  const world = createWorld();
  const renderables = new Map<Entity, Object3D>();

  function animate() {
    requestAnimationFrame(animate);
    const dt = clock.getDelta();

    renderSystem(world, renderables);
    renderer.render(scene, camera);
    clock.update();
  }
  animate();
}

main();
