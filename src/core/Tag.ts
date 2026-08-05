import type { Entity } from "./Entity";
import type { World } from "./World";

export type Tag = "block";

const EMPTY_TAG_SET: ReadonlySet<Tag> = new Set();
const EMPTY_ENTITY_SET: ReadonlySet<Entity> = new Set();

export function addTag(world: World, entity: Entity, tag: Tag): void {
  const entityTags = world.tags.get(entity) ?? new Set<Tag>();
  entityTags.add(tag);
  world.tags.set(entity, entityTags);

  const taggedEntities = world.tagIndex.get(tag) ?? new Set<Entity>();
  taggedEntities.add(entity);
  world.tagIndex.set(tag, taggedEntities);
}

export function removeTag(world: World, entity: Entity, tag: Tag): void {
  world.tags.get(entity)?.delete(tag);
  world.tagIndex.get(tag)?.delete(entity);
}

export function hasTag(world: World, entity: Entity, tag: Tag): boolean {
  return world.tags.get(entity)?.has(tag) ?? false;
}

export function getEntitiesByTag(world: World, tag: Tag): ReadonlySet<Entity> {
  return world.tagIndex.get(tag) ?? EMPTY_ENTITY_SET;
}

export function getTags(world: World, entity: Entity): ReadonlySet<Tag> {
  return world.tags.get(entity) ?? EMPTY_TAG_SET;
}

export function clearTags(world: World, entity: Entity): void {
  for (const tag of getTags(world, entity)) {
    world.tagIndex.get(tag)?.delete(entity);
  }
  world.tags.delete(entity);
}
