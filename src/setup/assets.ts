import { TextureLoader, type Object3D, type Texture } from "three";
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

/**
 * Image assets, on their own union rather than sharing `AssetId`: a texture is
 * not a model and has no `ModelId` to be a subset of.
 *
 * Loaded here but *configured* by whoever draws with it — wrapping, repeat and
 * colour space depend on the surface, not the file. Each one has a single
 * consumer, so that configuration is a mutation nobody else observes.
 */
export type TextureId = "arrow";

const textureCache = new Map<TextureId, Texture>();

export async function loadTextures(manifest: Record<TextureId, string>) {
  const loader = new TextureLoader();
  await Promise.all(
    Object.entries(manifest).map(async ([id, url]) => {
      textureCache.set(id as TextureId, await loader.loadAsync(url));
    }),
  );
}

export function getTextureById(id: TextureId): Texture {
  const texture = textureCache.get(id);
  if (!texture) throw new Error(`texture not loaded: ${id}`);
  return texture;
}
