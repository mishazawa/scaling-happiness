import { describe, expect, it } from "vitest";
import {
  BoxGeometry,
  BufferAttribute,
  Group,
  InstancedBufferAttribute,
  Mesh,
  Object3D,
  type BufferGeometry,
} from "three";
import { COLOR_ATTRIBUTE, PAWN_MODEL_RADIUS } from "../constants";
import { getModel, registerModel } from "./modelRegistry";

function tag(geometry: BufferGeometry) {
  const count = geometry.getAttribute("position").count;
  geometry.setAttribute(
    COLOR_ATTRIBUTE,
    new BufferAttribute(new Float32Array(count), 1),
  );
  return geometry;
}

function taggedMesh(size = 1) {
  return new Mesh(tag(new BoxGeometry(size, size, size)));
}

describe("modelRegistry", () => {
  it("allocates the per-instance attributes at the requested capacity", () => {
    const model = registerModel("pawn", taggedMesh(), 8, PAWN_MODEL_RADIUS);

    expect(model.capacity).toBe(8);
    expect(model.rows).toBeInstanceOf(InstancedBufferAttribute);
    expect(model.rows.array).toHaveLength(8);
    expect(model.phases.array).toHaveLength(8);
    expect(model.mesh.geometry.getAttribute("aRow")).toBe(model.rows);
    expect(model.mesh.geometry.getAttribute("aPhase")).toBe(model.phases);
  });

  it("starts with nothing drawn and culling disabled", () => {
    // Bounds come from the source geometry and say nothing about where the
    // instances actually are, so culling would pop pawns out at screen edges.
    const model = registerModel("pawn", taggedMesh(), 4, PAWN_MODEL_RADIUS);

    expect(model.mesh.count).toBe(0);
    expect(model.mesh.frustumCulled).toBe(false);
  });

  it("merges every primitive of a multi-material model", () => {
    // A glTF mesh is one primitive per material — the fish is four — and the
    // loader gives each its own Mesh. Taking only the first would render a
    // fraction of the model.
    const root = new Group();
    root.add(taggedMesh(), taggedMesh());
    const one = registerModel("pawn", taggedMesh(), 4, PAWN_MODEL_RADIUS);
    const two = registerModel("pawn", root, 4, PAWN_MODEL_RADIUS);

    expect(two.mesh.geometry.getAttribute("position").count).toBe(
      one.mesh.geometry.getAttribute("position").count * 2,
    );
  });

  it("bakes each node's world transform into the geometry", () => {
    // glTF puts the Y-up conversion on the node, but instance matrices are
    // built from a world position alone — anything left on the node is dropped.
    const mesh = taggedMesh();
    mesh.position.set(0, 4, 0);
    const model = registerModel("pawn", mesh, 4, PAWN_MODEL_RADIUS);

    expect(model.mesh.geometry.boundingSphere!.center.y).toBeGreaterThan(0);
    expect(model.mesh.geometry.boundingSphere!.radius).toBeCloseTo(
      PAWN_MODEL_RADIUS,
      5,
    );
  });

  it("does not consume the source geometry", () => {
    const mesh = taggedMesh();
    registerModel("pawn", mesh, 4, PAWN_MODEL_RADIUS);

    expect(mesh.geometry.getAttribute("aRow")).toBeUndefined();
  });

  it("propagates the missing colour-attribute failure", () => {
    expect(() =>
      registerModel(
        "pawn",
        new Mesh(new BoxGeometry(1, 1, 1)),
        4,
        PAWN_MODEL_RADIUS,
      ),
    ).toThrow(COLOR_ATTRIBUTE);
  });

  it("throws when the model has no meshes at all", () => {
    expect(() =>
      registerModel("pawn", new Object3D(), 4, PAWN_MODEL_RADIUS),
    ).toThrow("no meshes");
  });

  it("throws on an unregistered id rather than returning undefined", () => {
    expect(() => getModel("ghost" as "pawn")).toThrow("ghost");
  });
});
