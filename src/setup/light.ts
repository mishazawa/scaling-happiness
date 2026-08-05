import { AmbientLight, DirectionalLight } from "three";
import { LIGHT_MAIN_POSITION } from "../constants";

export function setupLight(scene) {
  const ambientLight = new AmbientLight(0xffffff, 0.6); // move to constants

  const directionalLight = new DirectionalLight(0xffffff, 0.8); // move to constants
  directionalLight.position.set(...LIGHT_MAIN_POSITION);

  directionalLight.castShadow = true;
  directionalLight.shadow.camera.left = -9; // move to constants this and other numbers
  directionalLight.shadow.camera.right = 9;
  directionalLight.shadow.camera.top = 8;
  directionalLight.shadow.camera.bottom = -8;
  directionalLight.shadow.camera.updateProjectionMatrix();
  directionalLight.shadow.mapSize.set(1024, 1024);

  scene.add(directionalLight);
  scene.add(ambientLight);
}
