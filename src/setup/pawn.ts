export function makePawn (world, 
  renderables,
  scene, {color,
  position
}) {
  entity = createEntity()
  
  world.positions set position
  world.color set color

  create renderable

  return entity
}