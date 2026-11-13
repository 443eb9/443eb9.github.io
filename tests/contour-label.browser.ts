import { expect, test } from '@playwright/test'

test('contour seams have matching tangents and island labels grow on one line', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/log/')
  await page.evaluate(() => document.fonts.ready)
  const seams = await page.locator('.contour-field path').evaluateAll(elements => elements.flatMap(element =>
    element.getAttribute('d')!.split('Z').filter(Boolean).map(ring => {
      const [move, ...curves] = ring.split('Q')
      const [x, y] = move.slice(1).split(',').map(Number)
      const first = curves[0].match(/-?[\d.]+/g)!.map(Number)
      const last = curves.at(-1)!.match(/-?[\d.]+/g)!.map(Number)
      return { close: Math.hypot(last[2] - x, last[3] - y), tangent: Math.hypot(first[0] - x, first[1] - y),
        dx: first[0] - x - (x - last[0]), dy: first[1] - y - (y - last[1]) }
    })))
  expect(seams.length).toBeGreaterThan(0)
  for (const seam of seams) {
    expect(seam.close).toBe(0)
    expect(seam.tangent).toBeGreaterThan(0)
    expect(Math.abs(seam.dx)).toBeLessThan(0.002)
    expect(Math.abs(seam.dy)).toBeLessThan(0.002)
  }
  for (const width of [1188, 390]) {
    await page.setViewportSize({ width, height: 740 })
    const label = page.locator('.island-title').first()
    await label.locator('span').first().evaluate(element => { element.textContent = '短标题' })
    const short = (await label.boundingBox())!.width
    await label.locator('span').first().evaluate(element => { element.textContent = '较长的岛屿标题，保持单行显示' })
    expect((await label.boundingBox())!.width).toBeGreaterThan(short)
    const line = await label.locator('span').first().evaluate(element => ({ height: element.getBoundingClientRect().height, lineHeight: parseFloat(getComputedStyle(element).lineHeight) }))
    expect(line.height).toBeCloseTo(line.lineHeight, 1)
  }
})
