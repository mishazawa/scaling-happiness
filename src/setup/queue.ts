import {
  BoxGeometry,
  Mesh,
  MeshBasicMaterial,
  Vector3,
  type Scene,
} from "three";
import {
  NUMBER_OF_QUEUES,
  PAWN_RADIUS,
  QUEUE_ADVANCE_DURATION,
  QUEUE_COLUMN_SPACING,
  QUEUE_DIRECTION,
  QUEUE_INITIAL_SIZE,
  QUEUE_OFFSET,
  QUEUE_PAWN_SCALE,
  QUEUE_PAWN_SCALE_TWEEN_DURATION,
  QUEUE_POSITION,
  QUEUE_SPACING,
  QUEUE_VISIBLE_SLOTS,
} from "../constants";
import { DEFAULT_SCALE } from "../core/Scale";
import { createEntity, type Entity } from "../core/Entity";
import { Position } from "../core/Position";
import { addTag, removeTag } from "../core/Tag";
import { dequeue, enqueue, type QueueId } from "../core/Queue";
import { PositionTween, ScalarTween } from "../core/Tween";
import type { World } from "../core/World";
import { addRenderable } from "../render/renderable";
import { randomPawnKind, spawnPawn } from "./pawn";

const DIRECTION = new Vector3(...QUEUE_DIRECTION);

/**
 * The click target for a queue.
 *
 * Queued pawns used to be the raycast targets themselves, but pawns are drawn as
 * instances now and have no `Object3D` to hit — an `InstancedMesh` hit would
 * only give back a slot index, which changes every frame. So each queue owns one
 * invisible box spanning its footprint, and `interaction.ts` resolves a hit
 * straight to the queue entity.
 *
 * The forward offset is baked into the geometry rather than set on the object:
 * a queue's position component is its *base*, and `renderSystem` re-centres the
 * object on it every frame, which would undo an offset stored on the transform.
 *
 * `visible = false` on the *material*, not the object: `Mesh.raycast` never
 * consults the material, so the box stays pickable while never being drawn.
 * Setting `object.visible` is not reliable for this — `Raycaster` does not check
 * it on the objects it is handed directly.
 */
const PICK_DEPTH = (QUEUE_VISIBLE_SLOTS - 1) * QUEUE_SPACING + PAWN_RADIUS * 2;
const PICK_GEOMETRY = new BoxGeometry(
  QUEUE_COLUMN_SPACING,
  PAWN_RADIUS * 2,
  PICK_DEPTH,
).translate(0, 0, (PICK_DEPTH - PAWN_RADIUS * 2) / 2);
const PICK_MATERIAL = new MeshBasicMaterial({ visible: false });

export function spawnQueue(
  world: World,
  scene: Scene,
  position: Vector3,
): QueueId {
  const entity = createEntity();

  world.positions.set(entity, Position(position.x, position.y, position.z));
  world.queues.set(entity, []);

  const pickBox = new Mesh(PICK_GEOMETRY, PICK_MATERIAL);
  pickBox.position.copy(position);
  addRenderable(world, scene, entity, pickBox);

  return entity;
}

/** Where the `index`th pawn of a queue based at `base` stands. */
function slotPosition(base: Vector3, index: number, out = new Vector3()) {
  return out.copy(base).addScaledVector(DIRECTION, QUEUE_SPACING * index);
}

/**
 * The one place a pawn becomes a queue member. Positioning is deliberately not
 * part of it — a pawn joins either by being placed (`addPawnToQueue`, at
 * construction) or by sliding in (`advanceQueue`), and keeping the membership
 * bookkeeping in one function is what stops the two paths drifting apart.
 */
function joinQueue(world: World, queueId: QueueId, pawn: Entity): void {
  enqueue(world, queueId, pawn);
  addTag(world, pawn, "queued");
  world.scaleTweens.set(
    pawn,
    ScalarTween(
      DEFAULT_SCALE,
      QUEUE_PAWN_SCALE,
      QUEUE_PAWN_SCALE_TWEEN_DURATION,
      "easeOutQuad",
    ),
  );
}

/** Snaps every member onto its slot. For building a queue, not for moving one. */
function layoutQueue(world: World, queueId: QueueId): void {
  const members = world.queues.get(queueId);
  const base = world.positions.get(queueId);
  if (!members || !base) return;

  members.forEach((member, index) => {
    const pos = world.positions.get(member);
    if (!pos) return;

    slotPosition(base, index, pos);
  });
}

/**
 * Sends every member toward its slot over `QUEUE_ADVANCE_DURATION`, from
 * wherever it currently stands. A pawn already mid-slide just gets a new tween
 * from its current position, so a second advance never snaps it back.
 */
function tweenQueueIntoLayout(world: World, queueId: QueueId): void {
  const members = world.queues.get(queueId);
  const base = world.positions.get(queueId);
  if (!members || !base) return;

  members.forEach((member, index) => {
    const pos = world.positions.get(member);
    if (!pos) return;

    world.positionTweens.set(
      member,
      PositionTween(
        pos,
        slotPosition(base, index),
        QUEUE_ADVANCE_DURATION,
        "easeInOutQuad",
      ),
    );
  });
}

export function addPawnToQueue(
  world: World,
  queueId: QueueId,
  pawn: Entity,
): void {
  joinQueue(world, queueId, pawn);
  layoutQueue(world, queueId);
}

/**
 * Takes the front pawn out of the queue and leaves the rest exactly where they
 * stand. Closing the gap is `advanceQueue`'s job, and it only happens once the
 * released pawn has reached the track — see `spawnSystem`.
 */
export function releasePawnFromQueue(
  world: World,
  queueId: QueueId,
): Entity | undefined {
  const pawn = dequeue(world, queueId);
  if (pawn === undefined) return undefined;

  removeTag(world, pawn, "queued");

  return pawn;
}

/**
 * Closes the gap left by a released pawn: a fresh pawn joins the back and the
 * whole queue slides one slot forward together.
 *
 * The new pawn is spawned one slot *behind* the place it will end up so that it
 * slides in with everybody else rather than popping into existence at the tail.
 * Both are off screen (`QUEUE_VISIBLE_SLOTS` is smaller than a queue), which is
 * exactly why it can afford to be created there.
 */
export function advanceQueue(world: World, queueId: QueueId): Entity {
  const base = world.positions.get(queueId) ?? new Vector3();
  const members = world.queues.get(queueId) ?? [];

  const pawn = spawnPawn(world, {
    ...randomPawnKind(),
    position: slotPosition(base, members.length + 1),
  });
  joinQueue(world, queueId, pawn);

  tweenQueueIntoLayout(world, queueId);

  return pawn;
}

/** Places a pawn straight onto the back of a queue. Used to build one. */
export function spawnQueuedPawn(world: World, queueId: QueueId): Entity {
  const position = world.positions.get(queueId) ?? new Vector3();

  const pawn = spawnPawn(world, { ...randomPawnKind(), position });

  addPawnToQueue(world, queueId, pawn);

  return pawn;
}

/** Builds every queue and fills it to its initial size. */
export function createQueues(world: World, scene: Scene) {
  for (let x = 0; x < NUMBER_OF_QUEUES; x++) {
    const queueId = spawnQueue(
      world,
      scene,
      new Vector3(...QUEUE_POSITION).setX(
        x * QUEUE_COLUMN_SPACING + QUEUE_OFFSET,
      ),
    );
    for (let i = 0; i < QUEUE_INITIAL_SIZE; i++) {
      spawnQueuedPawn(world, queueId);
    }
  }
}
