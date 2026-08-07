import { describe, expect, it } from "vitest";
import { BoxGeometry, Mesh, OrthographicCamera, Scene, Vector3 } from "three";
import { createWorld } from "../core/World";
import { createEntity } from "../core/Entity";
import { readEvents } from "../core/Event";
import { spawnQueue } from "../setup/queue";
import { addRenderable } from "./renderable";
import { handlePointerClick } from "./interaction";

/**
 * `Raycaster` is pure math — no GL context and no DOM — so the whole click path
 * is testable in node. That matters more here than usual: the pick target is an
 * invisible box, and if it ever stopped being hit the game would be silently
 * unplayable with nothing else failing.
 */
function setup() {
  // Stood well back, not at z = 10: the pick box runs QUEUE_VISIBLE_SLOTS deep
  // along +z from the queue's base, and a camera inside it sees only backfaces,
  // which `Mesh.raycast` culls. The real camera clears the box by height; this
  // one has to clear it by distance.
  const camera = new OrthographicCamera(-10, 10, 10, -10, 0.1, 200);
  camera.position.set(0, 0, 100);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();

  const domElement = {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
  } as unknown as HTMLElement;

  return { camera, domElement };
}

function click(x: number, y: number) {
  return { clientX: x, clientY: y } as PointerEvent;
}

describe("handlePointerClick", () => {
  it("resolves a hit on a queue's invisible pick box to that queue", () => {
    // Queued pawns are instanced and have no Object3D of their own, so the box
    // is the only thing left to hit. `Mesh.raycast` never consults the material,
    // which is what makes `visible: false` pickable — this is the assertion that
    // holds that behaviour in place.
    const { camera, domElement } = setup();
    const world = createWorld();
    const queueId = spawnQueue(world, new Scene(), new Vector3());

    handlePointerClick(world, camera, domElement, click(50, 50));

    expect(Array.from(readEvents(world, "queue-clicked"))).toEqual([
      { type: "queue-clicked", queue: queueId },
    ]);
  });

  it("emits nothing when the click misses every queue", () => {
    const { camera, domElement } = setup();
    const world = createWorld();
    spawnQueue(world, new Scene(), new Vector3());

    // Far right of the viewport, well outside the box's half-width.
    handlePointerClick(world, camera, domElement, click(98, 50));

    expect(Array.from(readEvents(world, "queue-clicked"))).toEqual([]);
  });

  it("ignores renderables that aren't queues", () => {
    // The debug path visualizer and any future scene dressing are raycast too;
    // hitting one must not read as a queue click.
    const { camera, domElement } = setup();
    const world = createWorld();
    const entity = createEntity();
    addRenderable(
      world,
      new Scene(),
      entity,
      new Mesh(new BoxGeometry(5, 5, 5)),
    );

    handlePointerClick(world, camera, domElement, click(50, 50));

    expect(Array.from(readEvents(world, "queue-clicked"))).toEqual([]);
  });
});
