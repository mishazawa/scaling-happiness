import { AmbientLight, DirectionalLight, type Scene } from "three";
import { LIGHT_MAIN_POSITION } from "../constants";

export function setupLight(scene: Scene) {
  const ambientLight = new AmbientLight(0xffffff, 1); // move to constants

  const directionalLight = new DirectionalLight(0xffffff, 5); // move to constants
  directionalLight.position.set(...LIGHT_MAIN_POSITION);

  directionalLight.castShadow = true;
  directionalLight.shadow.camera.left = -20; // move to constants this and other numbers
  directionalLight.shadow.camera.right = 20;
  directionalLight.shadow.camera.top = 20;
  directionalLight.shadow.camera.bottom = -20;
  directionalLight.shadow.camera.updateProjectionMatrix();
  directionalLight.shadow.mapSize.set(1024, 1024);

  scene.add(directionalLight);
  scene.add(ambientLight);
}
