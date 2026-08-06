import type { Object3D } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export type AssetId = "pawn";

const cache = new Map<AssetId, Object3D>();

export async function loadAssets(manifest: Record<AssetId, string>) {
  const loader = new GLTFLoader();
  await Promise.all(
    Object.entries(manifest).map(async ([id, url]) => {
      const gltf = await loader.loadAsync(url);
      cache.set(id as AssetId, gltf.scene);
    }),
  );
}

export function getAssetById(id: AssetId): Object3D {
  const p = cache.get(id);
  if (!p) throw new Error(`asset not loaded: ${id}`);
  return p;
}
