import { expect, test } from '@playwright/test'

for (const route of ['/', '/log/']) {
  test(`page wipe covers the old scene to its left when leaving ${route}`, async ({ page }) => {
    await page.setViewportSize({ width: 1731, height: 1013 })
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto(route)
    await page.evaluate(() => document.fonts.ready)
    await page.addStyleTag({ content: `
      .page-incoming .scene { background: rgb(0, 255, 0) !important; }
      .page-outgoing .scene { background: rgb(255, 0, 0) !important; }
      .page-incoming .scene > *, .page-outgoing .scene > * { visibility: hidden !important; }
    ` })
    await page.getByRole('link', { name: route === '/' ? '日志' : '返回首页', exact: true }).click()
    await expect(page.locator('.page-wipe')).toHaveCount(1)
    for (const time of [180, 260, 330, 400]) {
      const bounds = await page.locator('.page-incoming, .page-incoming > .page-content, .page-wipe').evaluateAll(async (elements, time) => {
        const animations = elements.flatMap(element => element.getAnimations())
        for (const animation of animations) {
          animation.pause()
          animation.currentTime = time
        }
        await Promise.all(animations.map(animation => animation.ready))
        const band = document.querySelector('.page-wipe')!.getBoundingClientRect()
        const incoming = document.querySelector('.page-incoming')!
        return { left: band.left, right: band.right, edge: incoming.getBoundingClientRect().right, contentLeft: incoming.firstElementChild!.getBoundingClientRect().left, scaledPixel: Math.ceil(band.width / (innerWidth * 0.08)) }
      }, time)
      expect(bounds.edge).toBeCloseTo(bounds.left, 1)
      expect(bounds.contentLeft).toBeCloseTo(0, 1)
      const screenshot = await page.screenshot()
      const mismatches = await page.evaluate(async ({ source, left, right, scaledPixel }) => {
        const image = new Image()
        image.src = `data:image/png;base64,${source}`
        await image.decode()
        const canvas = document.createElement('canvas')
        canvas.width = image.width
        canvas.height = image.height
        const context = canvas.getContext('2d')!
        context.drawImage(image, 0, 0)
        const row = context.getImageData(0, Math.floor(image.height / 2), image.width, 1).data
        const mismatches: { x: number; actual: number[]; expected: number[] }[] = []
        for (let x = 2; x < image.width - 2; x++) {
          if (Math.abs(x - left) < 2 || Math.abs(x - right) < scaledPixel + 1) continue
          const expected = x < left ? [0, 255, 0] : x < right ? [70, 100, 244] : [255, 0, 0]
          if (expected.some((value, channel) => Math.abs(row[x * 4 + channel] - value) > 1)) mismatches.push({ x, actual: Array.from(row.slice(x * 4, x * 4 + 3)), expected })
        }
        return mismatches
      }, { source: screenshot.toString('base64'), left: bounds.left, right: bounds.right, scaledPixel: bounds.scaledPixel })
      expect(mismatches, JSON.stringify({ time, bounds })).toEqual([])
    }
  })
}
