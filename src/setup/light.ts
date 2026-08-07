import { AmbientLight, DirectionalLight, type Scene } from "three";
import {
  LIGHT_AMBIENT_INTENSITY,
  LIGHT_COLOR,
  LIGHT_MAIN_INTENSITY,
  LIGHT_MAIN_POSITION,
  LIGHT_SHADOW_FRUSTUM_HALF_EXTENT,
  LIGHT_SHADOW_INTENSITY,
  LIGHT_SHADOW_MAP_SIZE,
} from "../constants";

export function setupLight(scene: Scene) {
  const ambientLight = new AmbientLight(LIGHT_COLOR, LIGHT_AMBIENT_INTENSITY);

  const directionalLight = new DirectionalLight(
    LIGHT_COLOR,
    LIGHT_MAIN_INTENSITY,
  );
  directionalLight.position.set(...LIGHT_MAIN_POSITION);

  // The shadow camera looks from the light's position at its target (the origin,
  // by default), so it inherits LIGHT_MAIN_POSITION and only needs its frustum
  // widened from Three.js' default 5 to cover the whole play field.
  directionalLight.castShadow = true;
  directionalLight.shadow.camera.left = -LIGHT_SHADOW_FRUSTUM_HALF_EXTENT;
  directionalLight.shadow.camera.right = LIGHT_SHADOW_FRUSTUM_HALF_EXTENT;
  directionalLight.shadow.camera.top = LIGHT_SHADOW_FRUSTUM_HALF_EXTENT;
  directionalLight.shadow.camera.bottom = -LIGHT_SHADOW_FRUSTUM_HALF_EXTENT;
  directionalLight.shadow.camera.updateProjectionMatrix();
  directionalLight.shadow.mapSize.set(
    LIGHT_SHADOW_MAP_SIZE,
    LIGHT_SHADOW_MAP_SIZE,
  );
  directionalLight.shadow.intensity = LIGHT_SHADOW_INTENSITY;

  scene.add(directionalLight);
  scene.add(ambientLight);
}
