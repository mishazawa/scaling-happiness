import { Mesh, MeshStandardMaterial, PlaneGeometry, type Scene } from "three";
import { BLOCK_SIZE, GROUND_COLOR, GROUND_SIZE } from "../constants";

export function setupGround(scene: Scene) {
  const geometry = new PlaneGeometry(GROUND_SIZE, GROUND_SIZE);
  const material = new MeshStandardMaterial({ color: GROUND_COLOR });

  const ground = new Mesh(geometry, material);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -BLOCK_SIZE / 2;
  ground.receiveShadow = true;

  scene.add(ground);
}
