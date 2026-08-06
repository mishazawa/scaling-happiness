import { OrthographicCamera } from "three";
import {
  CAMERA_FAR,
  CAMERA_FRUSTUM_SIZE,
  CAMERA_NEAR,
  CAMERA_POSITION,
  CAMERA_TARGET,
} from "../constants";

/**
 * Rebuilds the orthographic frustum for the container's current aspect.
 *
 * Note this derives half-width from the *live* container aspect rather than
 * the locked ASPECT_RATIO that constants.ts uses for its camera derivations.
 */
export function updateCameraFrustum(
  camera: OrthographicCamera,
  container: HTMLElement,
) {
  const aspect = container.clientWidth / container.clientHeight;
  const halfHeight = CAMERA_FRUSTUM_SIZE / 2;
  const halfWidth = halfHeight * aspect;

  camera.left = -halfWidth;
  camera.right = halfWidth;
  camera.top = halfHeight;
  camera.bottom = -halfHeight;
  camera.near = CAMERA_NEAR;
  camera.far = CAMERA_FAR;
  camera.updateProjectionMatrix();
}

export function createCamera(container: HTMLElement): OrthographicCamera {
  const camera = new OrthographicCamera();
  camera.position.set(...CAMERA_POSITION);
  camera.lookAt(...CAMERA_TARGET);
  updateCameraFrustum(camera, container);

  return camera;
}
