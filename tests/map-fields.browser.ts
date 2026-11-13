import { expect, test } from '@playwright/test'
import { type ContourCanvas, installContourProbe } from './contour-probe.ts'

test('sea dots keep their world positions while the map is dragged', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1188, height: 666 })
  await page.goto('/log/')
  await page.getByRole('button', { name: '第 2 页', exact: true }).click()
  await page.addStyleTag({ content: '.log > :not(.log-background) { opacity: 0 !important; }' })
  await page.mouse.move(-1000, -1000)
  const position = () => page.locator('.map-items').evaluate(element => {
    const matrix = new DOMMatrix(getComputedStyle(element).transform)
    return { x: matrix.e, y: matrix.f }
  })
  const beforePosition = await position()
  const before = await page.screenshot()
  await page.mouse.move(600, 350)
  await page.mouse.down()
  await page.mouse.move(504, 278, { steps: 5 })
  await page.mouse.up()
  await page.mouse.move(-1000, -1000)
  const afterPosition = await position()
  const after = await page.screenshot()
  const dx = afterPosition.x - beforePosition.x
  const dy = afterPosition.y - beforePosition.y
  expect(Math.abs(dx) + Math.abs(dy)).toBeGreaterThan(20)
  expect(dx).toBeCloseTo(Math.round(dx), 2)
  expect(dy).toBeCloseTo(Math.round(dy), 2)
  const errors = await page.evaluate(async ({ before, after, dx, dy }) => {
    const pixels = await Promise.all([before, after].map(async source => {
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
    let shifted = 0
    let fixed = 0
    let samples = 0
    for (let y = 40; y < innerHeight - 40; y++) for (let x = 40; x < innerWidth - 40; x++) {
      const targetX = x + Math.round(dx)
      const targetY = y + Math.round(dy)
      if (targetX < 40 || targetX >= innerWidth - 40 || targetY < 40 || targetY >= innerHeight - 40) continue
      const source = (y * innerWidth + x) * 4
      const target = (targetY * innerWidth + targetX) * 4
      shifted += Math.abs(pixels[0][source] - pixels[1][target])
      fixed += Math.abs(pixels[0][source] - pixels[1][source])
      samples++
    }
    return { shifted: shifted / samples, fixed: fixed / samples }
  }, { before: before.toString('base64'), after: after.toString('base64'), dx, dy })
  expect(errors.shifted).toBeLessThan(0.5)
  expect(errors.fixed).toBeGreaterThan(errors.shifted + 0.5)
})

for (const route of ['/', '/log/']) {
  test(`contours gain local height around the pointer on ${route}`, async ({ page }) => {
    await installContourProbe(page)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize({ width: 1188, height: 666 })
    await page.goto(route)
    const field = page.locator('.contour-field').first()
    const signature = () => field.locator('canvas').evaluate(element => (element as ContourCanvas).contourPixels?.reduce((hash, value) => Math.imul(hash ^ value, 16777619), 2166136261))
    await expect.poll(signature).toBeDefined()
    await page.mouse.move(-1000, -1000)
    const initial = await signature()
    const bounds = await field.boundingBox()
    expect(bounds).toBeTruthy()
    const x = route === '/' ? bounds!.x + bounds!.width / 2 : 450
    const y = route === '/' ? bounds!.y + bounds!.height / 2 : 350
    await page.mouse.move(x, y)
    await expect.poll(signature).not.toEqual(initial)
    await page.mouse.move(-1000, -1000)
    await expect.poll(signature).toEqual(initial)
  })
}
