import { expect, test } from '@playwright/test'

test('page two islands stay separated and map dragging stays inside padded terrain bounds', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 390, height: 740 })
  await page.goto('/log/')
  await page.getByRole('button', { name: '第 2 页', exact: true }).click()
  const read = () => page.locator('.map-items').evaluate(element => {
    const matrix = new DOMMatrix(getComputedStyle(element).transform)
    const cells = Array.from(element.querySelectorAll('.land-cell'), cell => ({ x: Number(cell.getAttribute('x')) - 1, y: Number(cell.getAttribute('y')) - 1 }))
    const size = Number(element.querySelector('pattern')!.getAttribute('width'))
    return { x: matrix.e, y: matrix.f,
      minX: 390 - Math.max(...cells.map(cell => cell.x + size)) - 9 - size,
      maxX: -Math.min(...cells.map(cell => cell.x)) + 9 + size,
      minY: 740 - Math.max(...cells.map(cell => cell.y + size)) - 9 - size,
      maxY: -Math.min(...cells.map(cell => cell.y)) + 9 + size }
  })
  const before = await read()
  await page.mouse.move(300, 350)
  await page.mouse.down()
  await page.mouse.move(-1000, -1000, { steps: 8 })
  await page.mouse.up()
  const after = await read()
  expect(after.x !== before.x || after.y !== before.y).toBe(true)
  expect(after.x).toBeCloseTo(after.minX, 1)
  expect(after.y).toBeCloseTo(after.minY, 1)
  await expect(page.locator('#island-card')).toHaveCount(0)
  await page.mouse.move(200, 350)
  await page.mouse.down()
  await page.mouse.move(1800, 1800, { steps: 8 })
  await page.mouse.up()
  const last = await read()
  expect(last.x).toBeCloseTo(last.maxX, 1)
  expect(last.y).toBeCloseTo(last.maxY, 1)
  await page.getByRole('button', { name: '目录', exact: true }).click()
  await page.locator('.directory-list button').nth(8).click()
  await expect(page.locator('#island-card')).toBeVisible()
  await page.mouse.move(5, 350)
  await page.mouse.down()
  await page.mouse.move(-150, 250, { steps: 5 })
  await page.mouse.up()
  const deltas = await page.evaluate(() => {
    const island = document.querySelector('.island.selected')!.getBoundingClientRect()
    const origin = document.querySelector('.connector-origin')!.getBoundingClientRect()
    return [island.x + island.width / 2 - origin.x - origin.width / 2, island.y + island.height / 2 - origin.y - origin.height / 2]
  })
  for (const delta of deltas) expect(Math.abs(delta)).toBeLessThan(0.1)
  await page.getByRole('button', { name: '关闭岛屿卡片' }).click()
  await expect(page.locator('#island-card')).toHaveCount(0)
  await page.screenshot({ path: info.outputPath('map-drag.png') })
})
