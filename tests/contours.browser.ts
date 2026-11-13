import { expect, test } from '@playwright/test'
import { createNoise3D } from 'simplex-noise'
import { randomSource } from '../src/terrain.ts'
import { type ContourCanvas, installContourProbe } from './contour-probe.ts'

test('GPU height samples match seeded simplex noise and pointer height stays local', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await installContourProbe(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1188, height: 666 })
  await page.goto('/')
  const canvas = page.locator('.valley .contour-field canvas')
  await expect.poll(() => canvas.evaluate(element => (element as ContourCanvas).contourDraws ?? 0)).toBeGreaterThan(0)
  const sample = () => canvas.evaluate(element => {
    const canvas = element as ContourCanvas
    const heights = canvas.contourHeights!
    const points = [[5, 5], [40, 30], [95, 59], [140, 90], [180, 110]]
    return points.map(([x, y]) => {
      const offset = (y * 192 + x) * 4
      return { x, y, height: (heights[offset] * 256 + heights[offset + 1]) / 65535 * 3 - 1 }
    })
  })
  const bounds = (await canvas.boundingBox())!
  const noise = createNoise3D(randomSource(109))
  const initial = await sample()
  for (const { x, y, height } of initial) {
    const expected = noise((x + 0.5) / 192 * (bounds.width / bounds.height) * 0.95 + 2, (1 - (y + 0.5) / 120) * 0.95, 0)
    expect(Math.abs(height - expected)).toBeLessThan(0.0005)
  }
  const painted = await canvas.evaluate(element => {
    const pixels = (element as ContourCanvas).contourPixels!
    const levels = new Set<number>()
    let colored = 0
    let maximumError = 0
    for (let index = 0; index < pixels.length; index += 4) {
      const alpha = pixels[index + 3]
      levels.add(alpha)
      if (alpha < 128) continue
      colored++
      for (let channel = 0; channel < 3; channel++) maximumError = Math.max(maximumError, Math.abs(pixels[index + channel] * 255 / alpha - 211))
    }
    return { levels: levels.size, colored, maximumError }
  })
  expect(painted.levels).toBeGreaterThan(16)
  expect(painted.colored).toBeGreaterThan(100)
  expect(painted.maximumError).toBeLessThan(3)
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
  const raised = await sample()
  expect(raised[2].height - initial[2].height).toBeGreaterThan(0.68)
  expect(raised[0].height).toBe(initial[0].height)
  expect(raised[4].height).toBe(initial[4].height)
  await page.mouse.move(-1000, -1000)
  expect(await sample()).toEqual(initial)
  await page.setViewportSize({ width: 1731, height: 1013 })
  await expect.poll(() => canvas.evaluate(element => {
    const canvas = element as ContourCanvas
    const bounds = canvas.getBoundingClientRect()
    return canvas.width === Math.ceil(bounds.width * devicePixelRatio) && canvas.height === Math.ceil(bounds.height * devicePixelRatio)
  })).toBe(true)
  expect(await canvas.evaluate(element => (element as HTMLCanvasElement).getContext('webgl2')!.getError())).toBe(0)
  expect(errors).toEqual([])
})
