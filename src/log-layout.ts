import { hash, islandPosition, islandShape } from './terrain.ts'

export function cardLayout(center: { x: number; y: number }, card: { width: number; height: number }, world: { width: number; height: number }) {
  const gap = logGrid(world.width).size * 0.6
  const right = center.x <= world.width / 2
  const below = center.y <= world.height / 2
  const left = Math.max(16, Math.min(center.x + (right ? gap : -gap - card.width), world.width - 16 - card.width))
  const top = Math.max(90, Math.min(center.y + (below ? gap : -gap - card.height), world.height - 90 - card.height))
  const cornerRight = center.x > left + card.width / 2
  const cornerBottom = center.y > top + card.height / 2
  const corner = (cornerBottom ? 2 : 0) + (cornerRight ? 1 : 0)
  return { left, top, corner, end: { x: left + (cornerRight ? card.width : 0), y: top + (cornerBottom ? card.height : 0) } }
}

export function logGrid(width: number) {
  return { size: width <= 800 ? 26 : 52, x: width <= 800 ? 4 : 30, y: 17 }
}

export function islandLayout(index: number, day: string, id: string, width: number, height: number) {
  const grid = logGrid(width)
  const position = islandPosition(index, day, id)
  const left = grid.x + Math.round((position.x / 100 * width - grid.size * 2.5 - grid.x) / grid.size) * grid.size
  const top = grid.y + Math.round((position.y / 100 * height - grid.size * 2.5 - grid.y) / grid.size) * grid.size
  const cells = islandShape(hash(`${day}:${id}`))
  const shape = cells.map(([x, y]) => `M${left + x * grid.size},${top + y * grid.size}h${grid.size}v${grid.size}h${-grid.size}Z`).join('')
  const occupied = new Set(cells.map(([x, y]) => `${x},${y}`))
  const border = cells.flatMap(([x, y]) => [
    occupied.has(`${x},${y - 1}`) ? '' : `M${left + x * grid.size},${top + y * grid.size}h${grid.size}`,
    occupied.has(`${x + 1},${y}`) ? '' : `M${left + (x + 1) * grid.size},${top + y * grid.size}v${grid.size}`,
    occupied.has(`${x},${y + 1}`) ? '' : `M${left + x * grid.size},${top + (y + 1) * grid.size}h${grid.size}`,
    occupied.has(`${x - 1},${y}`) ? '' : `M${left + x * grid.size},${top + y * grid.size}v${grid.size}`,
  ]).join('')
  return { left, top, cells, shape, border, center: { x: left + grid.size * 2.5, y: top + grid.size * 2.5 } }
}
