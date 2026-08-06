import { describe, expect, it } from "vitest";
import {
  BoxGeometry,
  BufferAttribute,
  Euler,
  Matrix4,
  Mesh,
  Quaternion,
  Scene,
  Vector3,
} from "three";
import { COLOR_ATTRIBUTE, PALETTES_IDX } from "../constants";
import { createWorld } from "../core/World";
import { Model } from "../core/Model";
import { spawnPawn } from "../setup/pawn";
import { spawnBlock } from "../setup/block";
import { markDestroyed } from "../core/destroy";
import { garbageCollectionSystem } from "../systems/garbageCollection";
import { createEntity } from "../core/Entity";
import { registerModel, getModel } from "./modelRegistry";
import { phaseForEntity, renderSystem } from "./renderSystem";
import { uniforms } from "./materials";

/**
 * The registry is module-global (it holds GPU resources that must outlive a
 * world rebuild), so every test here shares one "pawn" registration. Capacity is
 * small on purpose so the overflow case is reachable.
 */
const CAPACITY = 4;

function taggedMesh() {
  const geometry = new BoxGeometry(1, 1, 1);
  const count = geometry.getAttribute("position").count;
  geometry.setAttribute(
    COLOR_ATTRIBUTE,
    new BufferAttribute(new Float32Array(count), 1),
  );
  return new Mesh(geometry);
}

registerModel("pawn", taggedMesh(), CAPACITY, 1);
registerModel("block", taggedMesh(), CAPACITY, 1);

function position(entity: number) {
  const m = new Matrix4();
  getModel("pawn").mesh.getMatrixAt(entity, m);
  return new Vector3().setFromMatrixPosition(m);
}

describe("renderSystem", () => {
  it("advances the shared time uniform", () => {
    const world = createWorld();
    const before = uniforms.uTime.value;

    renderSystem(world, 0.25);

    expect(uniforms.uTime.value).toBeCloseTo(before + 0.25, 5);
  });

  it("packs instances into consecutive slots from zero", () => {
    const world = createWorld();
    spawnPawn(world, {
      flag: "light",
      palette: "koi",
      position: new Vector3(1, 0, 0),
    });
    spawnPawn(world, {
      flag: "dark",
      palette: "tide",
      position: new Vector3(2, 0, 0),
    });

    renderSystem(world, 0);

    const mesh = getModel("pawn").mesh;
    expect(mesh.count).toBe(2);
    expect(position(0).x).toBe(1);
    expect(position(1).x).toBe(2);
  });

  it("writes the palette row per instance", () => {
    const world = createWorld();
    spawnPawn(world, {
      flag: "light",
      palette: "koi",
      position: new Vector3(),
    });
    spawnPawn(world, {
      flag: "dark",
      palette: "tide",
      position: new Vector3(),
    });

    renderSystem(world, 0);

    const { rows } = getModel("pawn");
    expect(rows.array[0]).toBe(PALETTES_IDX.koi);
    expect(rows.array[1]).toBe(PALETTES_IDX.tide);
  });

  it("derives the animation phase from the entity id, deterministically", () => {
    const world = createWorld();
    const a = spawnPawn(world, {
      flag: "light",
      palette: "koi",
      position: new Vector3(),
    });
    const b = spawnPawn(world, {
      flag: "light",
      palette: "koi",
      position: new Vector3(),
    });

    renderSystem(world, 0);

    const { phases } = getModel("pawn");
    expect(phases.array[0]).toBeCloseTo(phaseForEntity(a), 5);
    expect(phases.array[1]).toBeCloseTo(phaseForEntity(b), 5);
    expect(phases.array[0]).not.toBe(phases.array[1]);
  });

  it("rewrites the phase when despawning shifts an entity's slot", () => {
    // Slots are repacked from zero every frame, so a phase written once at
    // spawn would follow the wrong entity as soon as anything ahead of it dies.
    const world = createWorld();
    const ctx = { scene: new Scene(), pathEntity: createEntity() };
    const first = spawnPawn(world, {
      flag: "light",
      palette: "koi",
      position: new Vector3(),
    });
    const second = spawnPawn(world, {
      flag: "light",
      palette: "koi",
      position: new Vector3(),
    });

    renderSystem(world, 0);
    markDestroyed(world, first);
    garbageCollectionSystem(world, ctx);
    renderSystem(world, 0);

    const { phases } = getModel("pawn");
    expect(getModel("pawn").mesh.count).toBe(1);
    expect(phases.array[0]).toBeCloseTo(phaseForEntity(second), 5);
  });

  it("drops the draw count to zero when the last instance dies", () => {
    const world = createWorld();
    spawnPawn(world, {
      flag: "light",
      palette: "koi",
      position: new Vector3(),
    });
    renderSystem(world, 0);
    expect(getModel("pawn").mesh.count).toBe(1);

    renderSystem(createWorld(), 0);

    expect(getModel("pawn").mesh.count).toBe(0);
  });

  it("throws loudly rather than silently dropping instances past capacity", () => {
    const world = createWorld();
    for (let i = 0; i <= CAPACITY; i++) {
      spawnPawn(world, {
        flag: "light",
        palette: "koi",
        position: new Vector3(),
      });
    }

    expect(() => renderSystem(world, 0)).toThrow(/capacity/);
  });

  it("writes an entity's yaw into its instance matrix", () => {
    const world = createWorld();
    const pawn = spawnPawn(world, {
      flag: "light",
      palette: "koi",
      position: new Vector3(1, 0, 0),
    });
    world.rotations.get(pawn)!.yaw = Math.PI / 2;

    renderSystem(world, 0);

    const m = new Matrix4();
    getModel("pawn").mesh.getMatrixAt(0, m);
    // Yaw must not disturb the translation column the position pass wrote.
    expect(new Vector3().setFromMatrixPosition(m).x).toBe(1);
    expect(new Euler().setFromRotationMatrix(m).y).toBeCloseTo(Math.PI / 2, 6);
  });

  it("writes an entity's uniform scale into its instance matrix, alongside its yaw", () => {
    const world = createWorld();
    const pawn = spawnPawn(world, {
      flag: "light",
      palette: "koi",
      position: new Vector3(1, 0, 0),
    });
    world.rotations.get(pawn)!.yaw = Math.PI / 2;
    world.scales.set(pawn, 0.25);

    renderSystem(world, 0);

    const m = new Matrix4();
    getModel("pawn").mesh.getMatrixAt(0, m);
    // Decomposed, not read off the raw basis: `setFromRotationMatrix` assumes
    // unscaled columns and reads a scaled matrix as a different rotation.
    const translation = new Vector3();
    const rotation = new Quaternion();
    const scale = new Vector3();
    m.decompose(translation, rotation, scale);

    // T·R·S: the scale must not shrink the translation or skew the rotation.
    expect(translation.x).toBe(1);
    expect(new Euler().setFromQuaternion(rotation).y).toBeCloseTo(
      Math.PI / 2,
      6,
    );
    expect(scale.toArray()).toEqual([0.25, 0.25, 0.25]);
  });

  it("leaves scale-less entities at full size", () => {
    const world = createWorld();
    spawnPawn(world, {
      flag: "light",
      palette: "koi",
      position: new Vector3(1, 0, 0),
    });

    renderSystem(world, 0);

    const m = new Matrix4();
    getModel("pawn").mesh.getMatrixAt(0, m);
    expect(new Vector3().setFromMatrixScale(m).toArray()).toEqual([1, 1, 1]);
  });

  it("leaves rotation-less entities on a pure translation", () => {
    const world = createWorld();
    spawnBlock(world, {
      flag: "light",
      palette: "koi",
      row: 0,
      column: 0,
      totalColumns: 1,
      position: new Vector3(3, 0, 0),
    });

    renderSystem(world, 0);

    const m = new Matrix4();
    getModel("block").mesh.getMatrixAt(0, m);
    const euler = new Euler().setFromRotationMatrix(m);
    expect(euler.x).toBeCloseTo(0, 6);
    expect(euler.y).toBeCloseTo(0, 6);
    expect(euler.z).toBeCloseTo(0, 6);
  });

  it("still syncs entities that own an Object3D", () => {
    const world = createWorld();
    const scene = new Scene();
    const entity = createEntity();
    world.positions.set(entity, new Vector3(0, 0, 0));
    const object3D = new Scene();
    world.renderables.set(entity, object3D);
    scene.add(object3D);

    world.positions.get(entity)!.set(5, 6, 7);
    renderSystem(world, 0);

    expect(object3D.position.toArray()).toEqual([5, 6, 7]);
  });

  it("counts each model's slots independently", () => {
    // Pawns and blocks share the repack loop but not their buffers; a single
    // running counter would interleave them into each other's meshes.
    const world = createWorld();
    spawnPawn(world, {
      flag: "light",
      palette: "koi",
      position: new Vector3(1, 0, 0),
    });
    spawnBlock(world, {
      flag: "light",
      palette: "koi",
      row: 0,
      column: 0,
      totalColumns: 2,
      position: new Vector3(7, 0, 0),
    });
    spawnBlock(world, {
      flag: "dark",
      palette: "tide",
      row: 0,
      column: 1,
      totalColumns: 2,
      position: new Vector3(8, 0, 0),
    });

    renderSystem(world, 0);

    expect(getModel("pawn").mesh.count).toBe(1);
    expect(getModel("block").mesh.count).toBe(2);

    const m = new Matrix4();
    getModel("block").mesh.getMatrixAt(0, m);
    expect(new Vector3().setFromMatrixPosition(m).x).toBe(7);
    expect(getModel("block").rows.array[1]).toBe(PALETTES_IDX.tide);
  });

  it("ignores model entities that have lost their position", () => {
    const world = createWorld();
    const entity = createEntity();
    world.models.set(entity, Model("pawn", "koi"));

    renderSystem(world, 0);

    expect(getModel("pawn").mesh.count).toBe(0);
  });
});
