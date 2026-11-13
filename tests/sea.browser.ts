import { expect, test } from '@playwright/test'

test('GPU sea dots retain continuous coverage, blue color, time changes and pointer response', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.setViewportSize({ width: 390, height: 740 })
  await page.goto('/log/')
  const canvas = page.locator('.sea-field canvas')
  await expect(canvas).toBeVisible()
  await page.mouse.move(-1000, -1000)
  const read = () => canvas.evaluate(element => new Promise<number[]>(resolve => requestAnimationFrame(() => {
    const canvas = element as HTMLCanvasElement
    const gl = canvas.getContext('webgl2')!
    const pixels = new Uint8Array(128 * 128 * 4)
    gl.readPixels(0, canvas.height - 128, 128, 128, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
    resolve(Array.from(pixels))
  })))
  const first = await read()
  const levels = new Set(first.filter((_, index) => index % 4 === 3))
  expect(levels.size).toBeGreaterThan(16)
  for (let offset = 0; offset < first.length; offset += 4) {
    const alpha = first[offset + 3]
    if (alpha < 128) continue
    for (const [channel, color] of [70, 100, 244].entries()) expect(first[offset + channel] * 255 / alpha).toBeCloseTo(color, -1)
  }
  await page.waitForTimeout(250)
  const second = await read()
  expect(second).not.toEqual(first)
  const alpha = (pixels: number[]) => pixels.reduce((sum, value, index) => sum + (index % 4 === 3 ? value : 0), 0)
  await page.mouse.move(64, 64)
  const near = await read()
  expect(alpha(near)).toBeGreaterThan(alpha(second))
  expect(errors).toEqual([])
})
