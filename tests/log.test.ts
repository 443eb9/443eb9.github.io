import assert from 'node:assert/strict'
import test from 'node:test'
import { cardLayout, connectorBand, islandLayouts, logGrid } from '../src/log-layout.ts'
import { createHalftone } from '../src/halftone.ts'

test('islands use the same world grid and central cell at desktop and mobile widths', () => {
  for (const width of [320, 390, 1188]) {
    const grid = logGrid(width)
    const layouts = islandLayouts(Array.from({ length: 7 }, (_, index) => `island-${index}`), '2026-11-12', width, 740)
    const occupied: { x: number; y: number; island: number }[] = []
    for (const [index, layout] of layouts.entries()) {
      for (const [x, y] of layout.cells) {
        const cell = { x: Math.round((layout.left - grid.x) / grid.size) + x, y: Math.round((layout.top - grid.y) / grid.size) + y, island: index }
        assert.ok(occupied.every(other => other.island === index || Math.abs(other.x - cell.x) > 1 || Math.abs(other.y - cell.y) > 1))
        occupied.push(cell)
      }
      assert.equal(Math.abs((layout.left - grid.x) % grid.size), 0)
      assert.equal(Math.abs((layout.top - grid.y) % grid.size), 0)
      assert.ok(layout.cells.some(([x, y]) => x === 2 && y === 2))
      assert.equal(layout.center.x, layout.left + grid.size * 2.5)
      assert.equal(layout.center.y, layout.top + grid.size * 2.5)
    }
  }
})

test('cards open toward the opposite quadrant and connect to the facing corner', () => {
  const world = { width: 1188, height: 666 }
  const card = { width: 420, height: 200 }
  for (const [x, y, corner] of [[200, 500, 2], [1000, 150, 1], [200, 150, 0], [1000, 500, 3]]) {
    const result = cardLayout({ center: { x, y }, bounds: { left: x - 70, top: y - 70, right: x + 70, bottom: y + 70 } }, card, world)
    assert.equal(result.corner, corner)
    assert.ok(result.left >= 16 && result.left + card.width <= world.width - 16)
    assert.ok(result.top >= 90 && result.top + card.height <= world.height - 90)
    assert.equal(result.end.x, result.left + (corner % 2 ? card.width : 0))
    assert.equal(result.end.y, result.top + (corner >= 2 ? card.height : 0))
    assert.ok(x < world.width / 2 ? result.left > x : result.left + card.width < x)
    assert.ok(y < world.height / 2 ? result.top > y : result.top + card.height < y)
  }
})

test('cards stay inside mobile bounds with measured sizes near viewport edges', () => {
  for (const width of [320, 390]) {
    const world = { width, height: 740 }
    for (const center of [{ x: 10, y: 10 }, { x: width - 10, y: 730 }]) {
      for (const height of [180, 400]) {
        const card = { width: width * 0.8, height }
        const result = cardLayout({ center, bounds: { left: center.x - 65, top: center.y - 65, right: center.x + 65, bottom: center.y + 65 } }, card, world)
        assert.ok(result.left >= 16 && result.left + card.width <= width - 16)
        assert.ok(result.top >= 90 && result.top + height <= 650)
      }
    }
  }
})

test('card placement separates island bounds and minimizes overlap in constrained space', () => {
  const island = { center: { x: 350, y: 350 }, bounds: { left: 200, top: 200, right: 500, bottom: 500 } }
  const card = { width: 420, height: 200 }
  const placed = cardLayout(island, card, { width: 1188, height: 666 })
  assert.ok(placed.left >= island.bounds.right || placed.left + card.width <= island.bounds.left || placed.top >= island.bounds.bottom || placed.top + card.height <= island.bounds.top)

  const constrained = { center: { x: 160, y: 370 }, bounds: { left: 60, top: 250, right: 260, bottom: 490 } }
  const largeCard = { width: 256, height: 400 }
  const result = cardLayout(constrained, largeCard, { width: 320, height: 740 })
  const overlap = (left: number, top: number) => Math.max(0, Math.min(left + 256, 260) - Math.max(left, 60)) * Math.max(0, Math.min(top + 400, 490) - Math.max(top, 250))
  const minimum = Math.min(...[16, 48].flatMap(left => [90, 250].map(top => overlap(left, top))))
  assert.equal(overlap(result.left, result.top), minimum)
})

test('connector bands meet opposite square corners and widen on diagonals', () => {
  const start = { x: 100, y: 100 }
  assert.equal(connectorBand(start, { x: 200, y: 200 }, 1), 'polygon(92px 108px, 192px 208px, 208px 192px, 108px 92px)')
  assert.equal(connectorBand(start, { x: 200, y: 100 }, 1), 'polygon(100px 108px, 200px 108px, 200px 92px, 100px 92px)')
  assert.equal(connectorBand(start, { x: 200, y: 200 }, 0.5), 'polygon(92px 108px, 142px 158px, 158px 142px, 108px 92px)')
})

test('sea dots have continuous size variation and grow near the pointer', () => {
  const image = { width: 128, height: 96, data: new Uint8ClampedArray(128 * 96 * 4) } as ImageData
  const render = createHalftone(image, (_x, _y, time) => Math.sin(time), 'sea', 1)
  const levels = new Set<number>()
  for (let frame = 0; frame < 64; frame++) {
    render(frame / 64, { x: -10000, y: -10000 })
    levels.add(image.data[(image.width + 1) * 4 + 3])
  }
  assert.ok(levels.size > 16)
  render(0.5, { x: -10000, y: -10000 })
  const alpha = () => image.data.reduce((sum, value, index) => sum + (index % 4 === 3 ? value : 0), 0)
  const initial = alpha()
  render(0.5, { x: 40, y: 30 })
  assert.ok(alpha() > initial)
  for (let offset = 0; offset < image.data.length; offset += 4) {
    if (image.data[offset + 3] > 0) assert.deepEqual(Array.from(image.data.subarray(offset, offset + 3)), [70, 100, 244])
  }
})
