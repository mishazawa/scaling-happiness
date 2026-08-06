import type { Object3D } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { ModelId } from "../core/Model";

/**
 * Assets are keyed by the model ids they back — one glTF file per model. Only
 * the *authored* models appear here; procedural ones (the block bubbles) are
 * built in code and never touch the loader. `Extract` keeps this a checked
 * subset of `ModelId` rather than a second union that can drift out of sync.
 *
 * Rendering resources are built from these by `render/modelRegistry.ts`; this
 * module only loads and caches the raw scene graphs.
 */
export type AssetId = Extract<ModelId, "pawn" | "track">;

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
