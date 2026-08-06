import type { PALETTES } from "../constants";

/**
 * How an entity says what it looks like: by *name*, never by object reference.
 *
 * The world holds these ids; `render/modelRegistry.ts` resolves them to the
 * actual `InstancedMesh`, and the palette module resolves the row. That split is
 * what keeps Three objects out of the component maps — an `InstancedMesh` is a
 * rendering resource shared by many entities, not per-entity state, and storing
 * one here would make the world unserializable.
 */
export type ModelId = "pawn" | "block";

export type PaletteName = keyof typeof PALETTES;

export type ModelData = {
  modelId: ModelId;
  palette: PaletteName;
};

export const Model = (modelId: ModelId, palette: PaletteName): ModelData => ({
  modelId,
  palette,
});
