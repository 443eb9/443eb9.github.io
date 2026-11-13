import { expect, test } from '@playwright/test'

type GridProbe = { row: number; pixels: number[]; frames: number }
type ProbeWindow = Window & { videoGridProbe: GridProbe }

test('video shader keeps the physical island cell size and grid alignment', async ({ page }) => {
  await page.addInitScript(() => {
    const draw = WebGL2RenderingContext.prototype.drawArrays
    WebGL2RenderingContext.prototype.drawArrays = function (...args) {
      draw.apply(this, args)
      const probe = (window as ProbeWindow).videoGridProbe
      if (!(this.canvas instanceof HTMLCanvasElement) || !this.canvas.classList.contains('video-islands') || !probe) return
      const pixels = new Uint8Array(this.canvas.width * 4)
      this.readPixels(0, this.canvas.height - 1 - Math.floor(probe.row), this.canvas.width, 1, this.RGBA, this.UNSIGNED_BYTE, pixels)
      probe.pixels = Array.from(pixels)
      probe.frames++
    }
  })
  await page.goto('/log')
  await expect(page.locator('.island')).toHaveCount(7)
  const grid = await page.locator('.terrain-map').evaluate(element => {
    const svg = element as SVGSVGElement
    const matrix = svg.getScreenCTM()!
    const pattern = svg.querySelector('pattern')!
    return {
      size: Number(pattern.getAttribute('width')) * matrix.a,
      gap: Number(pattern.querySelector('path')!.getAttribute('stroke-width')) * matrix.a,
      x: Number(pattern.getAttribute('x')) * matrix.a + matrix.e,
      y: Number(pattern.getAttribute('y')) * matrix.d + matrix.f,
    }
  })
  await page.evaluate(grid => {
    const row = grid.y + (Math.floor((innerHeight / 2 - grid.y) / grid.size) + 0.5) * grid.size
    ;(window as ProbeWindow).videoGridProbe = { row, pixels: [], frames: 0 }
  }, grid)
  await page.keyboard.type('apxple')
  await expect(page.getByRole('region', { name: 'Bad Apple 像素影像' })).toBeHidden()
  await page.keyboard.type('apple')

  const image = page.getByRole('img', { name: 'Bad Apple 岛屿方块影像' })
  const video = page.locator('.bad-apple-source')
  await expect(image).toBeVisible()
  await expect(page.locator('.island')).toHaveCount(0)
  await expect(page.locator('.contour-field')).toHaveCount(0)
  await expect(video).toHaveJSProperty('volume', 0.12)
  await expect(video).toHaveJSProperty('muted', false)
  await expect(video).toHaveCSS('opacity', '0')
  await expect.poll(() => video.evaluate(element => (element as HTMLVideoElement).currentTime)).toBeGreaterThan(0)
  await video.evaluate(element => { (element as HTMLVideoElement).currentTime = 31 })
  await expect.poll(() => page.evaluate(() => (window as ProbeWindow).videoGridProbe.pixels.some((value, index, pixels) => index % 4 === 0 && value > 60 && value < 80 && pixels[index + 2] > 230 && pixels[index + 3] === 255))).toBe(true)

  const probe = await page.evaluate(() => (window as ProbeWindow).videoGridProbe)
  const paper = await image.evaluate(element => getComputedStyle(element).stroke.match(/[\d.]+/g)!.slice(0, 3).map(Number))
  for (let x = grid.x + Math.ceil(-grid.x / grid.size) * grid.size; x < probe.pixels.length / 4; x += grid.size) {
    const index = Math.round(x) * 4
    expect(probe.pixels.slice(index, index + 4)).toEqual([...paper, 255])
  }
  const runs: { start: number; width: number }[] = []
  let start = -1
  for (let x = 0; x <= probe.pixels.length / 4; x++) {
    const red = probe.pixels[x * 4]
    const blue = red > 60 && red < 80 && probe.pixels[x * 4 + 2] > 230 && probe.pixels[x * 4 + 3] === 255
    if (blue && start < 0) start = x
    if (!blue && start >= 0) { runs.push({ start, width: x - start }); start = -1 }
  }
  const complete = runs.filter(run => run.start > 0 && run.start + run.width < probe.pixels.length / 4)
  expect(complete.length).toBeGreaterThanOrEqual(2)
  for (const run of complete) {
    expect(Math.abs(run.width - (grid.size - grid.gap))).toBeLessThanOrEqual(2)
    const column = (run.start - grid.x - grid.gap / 2) / grid.size
    expect(Math.abs(column - Math.round(column)) * grid.size).toBeLessThanOrEqual(2)
  }
  await expect.poll(() => page.evaluate(() => (window as ProbeWindow).videoGridProbe.frames)).toBeGreaterThan(probe.frames + 2)

  await page.keyboard.press('Escape')
  await expect(image).toHaveCount(0)
  await expect(video).toHaveJSProperty('paused', true)
  await expect(page.locator('.island')).toHaveCount(7)
  await page.keyboard.type('apple')
  await expect(image).toBeVisible()
  await video.evaluate(element => { const media = element as HTMLVideoElement; media.currentTime = media.duration - 0.1 })
  await expect(image).toHaveCount(0)
  await expect(page.locator('.island')).toHaveCount(7)
})

test('trigger stays on the log page, ignores editable fields and stops audio when leaving', async ({ page }) => {
  await page.goto('/neighbourhood')
  await page.keyboard.type('apple')
  await expect(page.locator('.bad-apple-source')).toHaveCount(0)
  await page.goto('/log')
  await page.evaluate(() => { const input = document.createElement('input'); input.id = 'typing-field'; document.body.append(input); input.focus() })
  await page.keyboard.type('apple')
  await expect(page.locator('.video-islands')).toHaveCount(0)
  await page.locator('#typing-field').evaluate(element => element.remove())
  await page.keyboard.type('apple')
  const video = await page.locator('.bad-apple-source').elementHandle()
  await expect(page.locator('.video-islands')).toBeVisible()
  await page.getByRole('link', { name: '返回首页', exact: true }).click()
  await expect(page.locator('.page-wipe')).toHaveCount(0)
  await expect(page.locator('.home')).toBeVisible()
  expect(await video!.evaluate(element => (element as HTMLVideoElement).paused)).toBe(true)
})
