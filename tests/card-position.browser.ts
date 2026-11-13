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
      const band = document.querySelector('.connector-inversion')!
      const points = getComputedStyle(band).clipPath.match(/-?[\d.]+/g)!.map(Number)
      const island = document.querySelector('.island.selected')!.getBoundingClientRect()
      const card = document.querySelector('#island-card')!.getBoundingClientRect()
      const land = document.querySelector('.selected-land')!.getBoundingClientRect()
      const overlap = Math.max(0, Math.min(card.right, land.right + 7) - Math.max(card.left, land.left - 7)) * Math.max(0, Math.min(card.bottom, land.bottom + 7) - Math.max(card.top, land.top - 7))
      const center = { x: island.x + island.width / 2, y: island.y + island.height / 2 }
      const end = { x: (points[2] + points[4]) / 2, y: (points[3] + points[5]) / 2 }
      return { overlap, left: card.left, top: card.top, right: card.right, bottom: card.bottom, center,
        cx: card.x + card.width / 2, cy: card.y + card.height / 2,
        dx: end.x - (center.x > card.x + card.width / 2 ? card.right : card.left),
        dy: end.y - (center.y > card.y + card.height / 2 ? card.bottom : card.top) }
    })
    expect(value.overlap).toBe(0)
    expect(value.cx > value.center.x).toBe(value.center.x < 594)
    expect(value.cy > value.center.y).toBe(value.center.y < 333)
    expect(Math.abs(value.dx)).toBeLessThan(0.15)
    expect(Math.abs(value.dy)).toBeLessThan(0.15)
    expect(value.left).toBeGreaterThanOrEqual(0)
    expect(value.top).toBeGreaterThanOrEqual(0)
    expect(value.right).toBeLessThanOrEqual(1188)
    expect(value.bottom).toBeLessThanOrEqual(666)
    if (index === 2) {
      const band = page.locator('.connector-inversion')
      const visible = await page.screenshot()
      await band.evaluate(element => { (element as HTMLElement).style.visibility = 'hidden' })
      const hidden = await page.screenshot()
      const swaps = await page.evaluate(async images => {
        const pixels = await Promise.all(images.map(async source => {
          const image = new Image()
          image.src = `data:image/png;base64,${source}`
          await image.decode()
          const canvas = document.createElement('canvas')
          canvas.width = image.width
          canvas.height = image.height
          const context = canvas.getContext('2d')!
          context.drawImage(image, 0, 0)
          return context.getImageData(0, 0, canvas.width, canvas.height).data
        }))
        const band = document.querySelector('.connector-inversion')!
        const points = getComputedStyle(band).clipPath.match(/-?[\d.]+/g)!.map(Number)
        const start = { x: (points[0] + points[6]) / 2, y: (points[1] + points[7]) / 2 }
        const end = { x: (points[2] + points[4]) / 2, y: (points[3] + points[5]) / 2 }
        const counts = [0, 0]
        const colors = [[70, 100, 244], [246, 246, 246]]
        for (let step = 10; step < 90; step++) {
          const point = { x: start.x + (end.x - start.x) * step / 100, y: start.y + (end.y - start.y) * step / 100 }
          const offset = (Math.floor(point.y) * innerWidth + Math.floor(point.x)) * 4
          for (let color = 0; color < 2; color++) {
            if (colors[color].every((value, channel) => Math.abs(pixels[1][offset + channel] - value) <= 1)
              && colors[1 - color].every((value, channel) => Math.abs(pixels[0][offset + channel] - value) <= 1)) counts[color]++
          }
        }
        return counts
      }, [visible.toString('base64'), hidden.toString('base64')])
      expect(swaps[0]).toBeGreaterThan(0)
      expect(swaps[1]).toBeGreaterThan(0)
      await band.evaluate(element => { (element as HTMLElement).style.visibility = 'visible' })
    }
    await page.keyboard.press('Escape')
    await expect(card).toHaveCount(0)
  }
})
