import { hash, islandPosition, islandShape } from './terrain.ts'

export function connectorBand(start: { x: number; y: number }, end: { x: number; y: number }, progress: number, unit = 1) {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const half = 8
  const offset = { x: -Math.sign(dy) * half, y: Math.sign(dx) * half }
  const front = { x: start.x + dx * progress, y: start.y + dy * progress }
  const points = [
    { x: start.x + offset.x, y: start.y + offset.y },
    { x: front.x + offset.x, y: front.y + offset.y },
    { x: front.x - offset.x, y: front.y - offset.y },
    { x: start.x - offset.x, y: start.y - offset.y },
  ]
  return `polygon(${points.map(point => `${point.x * unit}px ${point.y * unit}px`).join(', ')})`
}

export function cardLayout(island: { center: { x: number; y: number }; bounds: { left: number; top: number; right: number; bottom: number } }, card: { width: number; height: number }, world: { width: number; height: number }) {
  const { center, bounds } = island
  const gap = logGrid(world.width).size * 0.6
  const xMin = 16
  const xMax = Math.max(xMin, world.width - 16 - card.width)
  const yMin = 90
  const yMax = Math.max(yMin, world.height - 90 - card.height)
  const right = bounds.right + gap
  const leftSide = bounds.left - gap - card.width
  const below = bounds.bottom + gap
  const above = bounds.top - gap - card.height
  const preferredX = center.x <= world.width / 2 ? right : leftSide
  const preferredY = center.y <= world.height / 2 ? below : above
  let left = xMin
  let top = yMin
  let bestOverlap = Infinity
  let bestDistance = Infinity

  for (const x of [preferredX, right, leftSide, xMin, xMax]) {
    for (const y of [preferredY, below, above, yMin, yMax]) {
      const candidateX = Math.max(xMin, Math.min(x, xMax))
      const candidateY = Math.max(yMin, Math.min(y, yMax))
      const overlap = Math.max(0, Math.min(candidateX + card.width, bounds.right) - Math.max(candidateX, bounds.left))
        * Math.max(0, Math.min(candidateY + card.height, bounds.bottom) - Math.max(candidateY, bounds.top))
      const distance = (candidateX - preferredX) ** 2 + (candidateY - preferredY) ** 2
      if (overlap < bestOverlap || (overlap === bestOverlap && distance < bestDistance)) {
        left = candidateX
        top = candidateY
        bestOverlap = overlap
        bestDistance = distance
      }
    }
  }

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
  const bounds = {
    left: left + Math.min(...cells.map(([x]) => x)) * grid.size - 7,
    top: top + Math.min(...cells.map(([, y]) => y)) * grid.size - 7,
    right: left + (Math.max(...cells.map(([x]) => x)) + 1) * grid.size + 7,
    bottom: top + (Math.max(...cells.map(([, y]) => y)) + 1) * grid.size + 7,
  }
  return { left, top, cells, shape, border, bounds, center: { x: left + grid.size * 2.5, y: top + grid.size * 2.5 } }
}
