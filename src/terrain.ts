export const PAGE_SIZE = 7

export function hash(text: string) {
  let value = 2166136261
  for (const character of text) value = Math.imul(value ^ character.charCodeAt(0), 16777619)
  return value >>> 0
}

export function randomSource(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

export function islandShape(seed: number) {
  const random = randomSource(seed)
  const cells: [number, number][] = [[2, 2]]
  const occupied = new Set(['2,2'])
  const target = 6 + Math.floor(random() * 6)
  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]]
  let attempts = 0
  while (cells.length < target && attempts++ < 400) {
    const cell = cells[Math.floor(random() * cells.length)]
    const direction = directions[Math.floor(random() * directions.length)]
    const x = cell[0] + direction[0]
    const y = cell[1] + direction[1]
    const key = `${x},${y}`
    if (x >= 0 && x < 5 && y >= 0 && y < 5 && !occupied.has(key)) {
      occupied.add(key)
      cells.push([x, y])
    }
  }
  return cells
}

export function islandPosition(index: number, day: string, id: string) {
  const positions = [[13, 16], [35, 24], [89, 37], [21, 48], [33, 67], [60, 59], [16, 94]]
  const random = randomSource(hash(`${day}:${id}`))
  const [x, y] = positions[index % PAGE_SIZE]
  return { x: x + (random() - 0.5) * 5, y: y + (random() - 0.5) * 5 }
}
