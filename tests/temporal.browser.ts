import { expect, test } from '@playwright/test'
import { type ContourCanvas, installContourProbe } from './contour-probe.ts'

test('canine halftone changes with time while the pointer stays fixed', async ({ page }, info) => {
  const time = new Date('2026-11-12T08:00:00Z')
  await page.clock.install({ time })
  await page.clock.pauseAt(time)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')
  await page.evaluate(() => document.fonts.ready)
  await page.clock.runFor(600)
  const field = page.locator('.layer-one .noise-field')
  const read = () => field.evaluate(element => {
    const canvas = element as HTMLCanvasElement
    const pixels = canvas.getContext('2d')!.getImageData(Math.floor(canvas.width * 0.7), Math.floor(canvas.height * 0.45), 128, 128).data
    return Array.from(pixels.filter((_, index) => index % 4 === 3))
  })
  const first = await read()
  await page.screenshot({ path: info.outputPath('canine-time-600.png'), clip: { x: 1300, y: 550, width: 500, height: 250 } })
  await page.clock.runFor(3000)
  const second = await read()
  const changed = first.filter((value, index) => value !== second[index]).length / first.length
  expect(changed).toBeGreaterThan(0.05)
  await page.screenshot({ path: info.outputPath('canine-time-3600.png'), clip: { x: 1300, y: 550, width: 500, height: 250 } })
  await info.attach('temporal-change', { body: JSON.stringify({ samplePixels: first.length, changedFraction: changed }), contentType: 'application/json' })
})

test('home contours update at the animation cadence', async ({ page }) => {
  await installContourProbe(page, false)
  const time = new Date('2026-11-12T08:00:00Z')
  await page.clock.install({ time })
  await page.clock.pauseAt(time)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')
  await page.evaluate(() => document.fonts.ready)
  await page.clock.runFor(600)
  const canvas = page.locator('.valley .contour-field canvas')
  const count = () => canvas.evaluate(element => (element as ContourCanvas).contourDraws ?? 0)
  const before = await count()
  await page.clock.runFor(1000)
  const updates = await count() - before
  expect(updates).toBeGreaterThanOrEqual(50)
  expect(updates).toBeLessThanOrEqual(65)
})
