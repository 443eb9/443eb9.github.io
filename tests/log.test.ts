import assert from 'node:assert/strict'
import test from 'node:test'
import { islandLayout, logGrid } from '../src/log-layout.ts'
import { createHalftone } from '../src/halftone.ts'

test('islands use the same world grid and central cell at desktop and mobile widths', () => {
  for (const width of [320, 390, 1188]) {
    const grid = logGrid(width)
    for (let index = 0; index < 7; index++) {
      const layout = islandLayout(index, '2026-11-12', `island-${index}`, width, 740)
      assert.equal(Math.abs((layout.left - grid.x) % grid.size), 0)
      assert.equal(Math.abs((layout.top - grid.y) % grid.size), 0)
      assert.ok(layout.cells.some(([x, y]) => x === 2 && y === 2))
      assert.equal(layout.center.x, layout.left + grid.size * 2.5)
      assert.equal(layout.center.y, layout.top + grid.size * 2.5)
    }
  }
})

test('sea dots have continuous coverage and preserve their colors under the pointer', () => {
  const image = { width: 128, height: 96, data: new Uint8ClampedArray(128 * 96 * 4) } as ImageData
  const render = createHalftone(image, (_x, _y, time) => Math.sin(time), 'sea', 1)
  const levels = new Set<number>()
  for (let frame = 0; frame < 64; frame++) {
    render(frame / 64, { x: -10000, y: -10000 })
    levels.add(image.data[(image.width + 1) * 4 + 3])
  }
  assert.ok(levels.size > 16)
  render(0.5, { x: -10000, y: -10000 })
  const initial = image.data.slice()
  render(0.5, { x: 40, y: 30 })
  assert.deepEqual(image.data, initial)
})
