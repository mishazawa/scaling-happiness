import { describe, it, expect } from "vitest";
import { Mesh, MeshStandardMaterial } from "three";
import { makePearl, PEARL_GEOMETRY, PEARL_MATERIAL } from "./pearl";
import {
  HEIGHT_OFFSET,
  PEARL_COLOR,
  PEARL_METALNESS,
  PEARL_POSITION,
  PEARL_RADIUS,
  PEARL_ROUGHNESS,
} from "../constants";

describe("makePearl", () => {
  it("is a glossy dielectric rather than a metal", () => {
    // The low roughness is the gloss; a pearl reflects, it does not shine like
    // the metal it would be at a high metalness with no environment to mirror.
    const material = PEARL_MATERIAL as MeshStandardMaterial;

    expect(material.color.getHex()).toBe(PEARL_COLOR);
    expect(material.metalness).toBe(PEARL_METALNESS);
    expect(material.roughness).toBe(PEARL_ROUGHNESS);
    expect(material.roughness).toBeLessThan(0.2);
  });

  it("stands where the track's mouth was authored", () => {
    const pearl = makePearl();

    expect(pearl.position.toArray()).toEqual(PEARL_POSITION);
  });

  it("rests on the static scenery's plane rather than sinking into it", () => {
    // The position is the sphere's centre, so a radius of clearance is what
    // puts its underside on HEIGHT_OFFSET, where the track sits.
    const pearl = makePearl();

    expect(pearl.position.y - PEARL_RADIUS).toBeCloseTo(HEIGHT_OFFSET, 6);
  });

  /**
   * Its size lives in the geometry, not in a scale on the mesh: the pearls a
   * life change throws are this same sphere drawn smaller, and LIFE_PEARL_SCALE
   * is only a fraction of *this* one so long as this one is drawn at 1.
   */
  it("carries its size in the geometry, drawn unscaled", () => {
    const pearl = makePearl();

    PEARL_GEOMETRY.computeBoundingSphere();
    expect(PEARL_GEOMETRY.boundingSphere!.radius).toBeCloseTo(PEARL_RADIUS, 6);
    expect(pearl.scale.toArray()).toEqual([1, 1, 1]);
  });

  it("shares one geometry and one material with every pearl drawn from them", () => {
    // reflectiveMaterial mints a fresh instance per call, so a pearl built per
    // spawn would be a new material every time the life count moved.
    const first = makePearl() as Mesh;
    const second = makePearl() as Mesh;

    expect(first.geometry).toBe(PEARL_GEOMETRY);
    expect(first.material).toBe(PEARL_MATERIAL);
    expect(second.geometry).toBe(first.geometry);
    expect(second.material).toBe(first.material);
  });

  it("takes part in the scene's lighting", () => {
    const pearl = makePearl();

    expect(pearl.castShadow).toBe(true);
    expect(pearl.receiveShadow).toBe(true);
  });
});
