import { expect, test } from '@playwright/test'

test('cards follow opposite islands and connect to the facing corners', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.clock.setFixedTime(new Date('2026-11-12T08:00:00Z'))
  await page.setViewportSize({ width: 1188, height: 666 })
  await page.goto('/log/')
  await page.evaluate(() => document.fonts.ready)
  for (const index of [2, 4]) {
    await page.getByRole('button', { name: '目录', exact: true }).click()
    await page.locator('.directory-list button').nth(index).click()
    const card = page.locator('#island-card')
    await expect(card).toBeVisible()
    const value = await page.evaluate(() => {
      const svg = document.querySelector('.connector') as SVGSVGElement
      const path = svg.querySelector('path') as SVGPathElement
      const island = document.querySelector('.island.selected')!.getBoundingClientRect()
      const card = document.querySelector('#island-card')!.getBoundingClientRect()
      const center = { x: island.x + island.width / 2, y: island.y + island.height / 2 }
      const end = path.getPointAtLength(path.getTotalLength()).matrixTransform(svg.getScreenCTM()!)
      return { left: card.left, top: card.top, right: card.right, bottom: card.bottom, center,
        cx: card.x + card.width / 2, cy: card.y + card.height / 2,
        dx: end.x - (center.x > card.x + card.width / 2 ? card.right : card.left),
        dy: end.y - (center.y > card.y + card.height / 2 ? card.bottom : card.top) }
    })
    expect(value.cx > value.center.x).toBe(value.center.x < 594)
    expect(value.cy > value.center.y).toBe(value.center.y < 333)
    expect(Math.abs(value.dx)).toBeLessThan(0.15)
    expect(Math.abs(value.dy)).toBeLessThan(0.15)
    expect(value.left).toBeGreaterThanOrEqual(0)
    expect(value.top).toBeGreaterThanOrEqual(0)
    expect(value.right).toBeLessThanOrEqual(1188)
    expect(value.bottom).toBeLessThanOrEqual(666)
    await page.keyboard.press('Escape')
    await expect(card).toHaveCount(0)
  }
})
