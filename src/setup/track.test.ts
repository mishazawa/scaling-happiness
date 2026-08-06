import { describe, it, expect } from "vitest";
import { Vector3 } from "three";
import { makePathAroundTheGrid } from "./track";
import {
  TRACK_CHECKPOINTS,
  TRACK_CORNER_RADIUS,
  TRACK_END_T,
  TRACK_START_T,
} from "../constants";

const corners = TRACK_CHECKPOINTS.map(([x, y, z]) => new Vector3(x, y, z));

// The half-extents the checkpoints describe. Read off the authored corners
// rather than recomputed from the grid, so these tests keep testing the shape
// the game actually walks if the checkpoints are ever moved.
const halfWidth = Math.max(...corners.map((c) => Math.abs(c.x)));
const halfDepth = Math.max(...corners.map((c) => Math.abs(c.z)));

describe("makePathAroundTheGrid", () => {
  it("produces an open path: no closing segment back to the first point", () => {
    const path = makePathAroundTheGrid();

    expect(path.segLengths.length).toBe(path.points.length - 1);
  });

  it("covers the TRACK_START_T..TRACK_END_T fraction of the checkpoint loop, minus what the rounded corners cut", () => {
    const fullPerimeter = corners.reduce(
      (sum, corner, i) =>
        sum + corner.distanceTo(corners[(i + 1) % corners.length]),
      0,
    );
    const sharpTotal = (TRACK_END_T - TRACK_START_T) * fullPerimeter;

    const path = makePathAroundTheGrid();

    // Cutting corners can only shorten the track, and only slightly.
    expect(path.total).toBeLessThanOrEqual(sharpTotal);
    expect(path.total).toBeGreaterThan(sharpTotal * 0.95);
  });

  it("starts and ends inside the checkpoint loop rather than at a corner", () => {
    const path = makePathAroundTheGrid();

    const start = path.points[0];
    const end = path.points[path.points.length - 1];
    for (const corner of corners) {
      expect(start.distanceTo(corner)).toBeGreaterThan(0);
      expect(end.distanceTo(corner)).toBeGreaterThan(0);
    }
  });

  it("never bulges outside the sharp corner it rounds", () => {
    const path = makePathAroundTheGrid();

    for (const point of path.points) {
      expect(Math.abs(point.x)).toBeLessThanOrEqual(halfWidth + 1e-9);
      expect(Math.abs(point.z)).toBeLessThanOrEqual(halfDepth + 1e-9);
    }
  });

  it("turns at every checkpoint the slice keeps, in authored order", () => {
    // The cut straddles the first checkpoint, so the track runs from just past
    // it to just before it; the other three survive as filleted turns, which a
    // fillet leaves within TRACK_CORNER_RADIUS of the sharp corner it replaced.
    const path = makePathAroundTheGrid();

    const closest = corners.slice(1).map((corner) => {
      let best = 0;
      for (let i = 1; i < path.points.length; i++) {
        if (
          path.points[i].distanceTo(corner) <
          path.points[best].distanceTo(corner)
        )
          best = i;
      }
      return { index: best, distance: path.points[best].distanceTo(corner) };
    });

    for (const { distance } of closest) {
      expect(distance).toBeLessThanOrEqual(TRACK_CORNER_RADIUS);
    }
    // Travel order: the track meets them in the order they are authored.
    expect(closest.map((c) => c.index)).toEqual(
      [...closest.map((c) => c.index)].sort((a, b) => a - b),
    );
  });
});
