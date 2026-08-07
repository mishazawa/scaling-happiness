import { Mesh, MeshStandardMaterial, PlaneGeometry, type Scene } from "three";
import { BLOCK_SIZE, GROUND_COLOR, GROUND_SIZE } from "../constants";
import { withCaustics } from "../render/materials";

export function setupGround(scene: Scene) {
  const geometry = new PlaneGeometry(GROUND_SIZE, GROUND_SIZE);
  // The floor is where cast light actually pools, so it carries the caustics
  // too — same patch, same clock as the models swimming over it.
  const material = withCaustics(
    new MeshStandardMaterial({ color: GROUND_COLOR }),
  );

  const ground = new Mesh(geometry, material);

  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -BLOCK_SIZE / 2 - 1;
  ground.receiveShadow = true;

  scene.add(ground);
}
