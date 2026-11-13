import { expect, test } from '@playwright/test'

function inset(value: string) {
  const [top, right = top, bottom = top, left = right] = value.match(/-?[\d.]+/g)!.map(Number)
  return { top, right, bottom, left }
}

test('world grid, hover colors, card graphics and regular description text match the scene', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  for (const width of [2376, 1188, 390, 320]) {
    await page.setViewportSize({ width, height: width > 800 ? Math.round(width * 1332 / 2376) : 740 })
    await page.goto('/log/')
    await page.evaluate(() => document.fonts.ready)
    await expect(page.locator('.island')).toHaveCount(7)
    const grid = await page.locator('.terrain-map').evaluate(element => {
      const pattern = element.querySelector('pattern')!
      const size = Number(pattern.getAttribute('width'))
      const x = Number(pattern.getAttribute('x'))
      const y = Number(pattern.getAttribute('y'))
      return Array.from(element.querySelectorAll('.land-cell'), cell => [
        (Number(cell.getAttribute('x')) - 1 - x) / size,
        (Number(cell.getAttribute('y')) - 1 - y) / size,
        Number(cell.getAttribute('width')) + 2 - size,
      ])
    })
    expect(grid.length).toBeGreaterThan(20)
    for (const [x, y, difference] of grid) {
      expect(x).toBeCloseTo(Math.round(x), 6)
      expect(y).toBeCloseTo(Math.round(y), 6)
      expect(difference).toBe(0)
    }
    await expect(page.locator('.terrain-map .contour-field')).toHaveCount(1)
    const painted = await page.locator('.noise-field').evaluate(element => {
      const canvas = element as HTMLCanvasElement
      return canvas.getContext('2d')!.getImageData(0, 0, 64, 64).data.some((value, index) => index % 4 === 3 && value > 0)
    })
    expect(painted).toBe(true)
    const read = () => page.screenshot({ clip: { x: 0, y: 0, width: 64, height: 64 } })
    const pixels = await read()
    await page.locator('.island-hit').nth(3).hover()
    expect(await read()).toEqual(pixels)
    await expect(page.locator('.island-fill')).toHaveCSS('fill', 'rgb(211, 211, 211)')
    await expect(page.locator('.log-background')).toHaveCSS('transform', 'none')
    await expect(page.locator('.island-map')).toHaveCSS('transform', 'none')
  }

  await page.setViewportSize({ width: 2376, height: 1332 })
  await page.goto('/log/')
  await page.evaluate(() => document.fonts.ready)
  await page.locator('.island-hit').nth(1).click()
  const card = page.locator('#island-card')
  await expect(card).toBeVisible()
  await expect.poll(async () => inset(await card.evaluate(element => getComputedStyle(element).clipPath)).right).toBe(-10)
  await expect(card.locator('.card-description')).toHaveCSS('font-weight', '400')
  await expect(card.locator('.card-date')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(card.locator('.card-date')).toHaveCSS('border-bottom-color', 'rgb(70, 100, 244)')
  await expect(card.locator('.close-card')).toHaveCSS('background-color', 'rgb(211, 211, 211)')
  await expect(card.locator('.card-pixels')).toHaveCount(1)
  expect(await card.locator('.tag').count()).toBeGreaterThan(0)
  for (const tag of await card.locator('.tag').all()) await expect(tag.locator('.tag-corner')).toHaveCount(4)
  await expect(page.getByRole('button', { name: '上一页' }).locator('.page-button-label')).toHaveText('<')
  await expect(page.getByRole('button', { name: '下一页' }).locator('.page-button-label')).toHaveText('>')
  const endpoints = await page.locator('.connector').evaluate(element => {
    const svg = element as SVGSVGElement
    const [x1, y1, x2, y2] = element.querySelector('path')!.getAttribute('d')!.match(/-?[\d.]+/g)!.map(Number)
    const start = new DOMPoint(x1, y1).matrixTransform(svg.getScreenCTM()!)
    const end = new DOMPoint(x2, y2).matrixTransform(svg.getScreenCTM()!)
    const island = document.querySelector('.island.selected')!.getBoundingClientRect()
    const card = document.querySelector('#island-card')!.getBoundingClientRect()
    return [start.x - island.x - island.width / 2, start.y - island.y - island.height / 2, end.x - card.x, end.y - card.y]
  })
  for (const delta of endpoints) expect(Math.abs(delta)).toBeLessThan(0.1)
  await expect(page.locator('.connector-band')).toHaveCSS('stroke', 'rgb(246, 246, 246)')
  await expect(page.locator('.connector-origin')).toHaveCSS('stroke', 'rgb(246, 246, 246)')
  await expect(page.locator('.directory-marker')).toBeVisible()
  await page.screenshot({ path: info.outputPath('log-details.png') })
})

test('connector completes before card reveal, directory opens downward and pagination sweeps upward', async ({ page }, info) => {
  const time = new Date('2026-11-12T08:00:00Z')
  await page.clock.install({ time })
  await page.clock.pauseAt(time)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/log/')
  await page.evaluate(() => document.fonts.ready)
  await page.clock.runFor(600)
  await page.locator('.island-hit').nth(1).click()
  const card = page.locator('#island-card')
  await page.clock.runFor(200)
  expect(inset(await card.evaluate(element => getComputedStyle(element).clipPath)).right).toBe(100)
  const length = await page.locator('.connector-band').evaluate(element => parseFloat(getComputedStyle(element).strokeDasharray))
  expect(length).toBeGreaterThan(0)
  expect(length).toBeLessThan(1)
  await page.screenshot({ path: info.outputPath('connector-200.png') })
  await page.clock.runFor(300)
  const progress = inset(await card.evaluate(element => getComputedStyle(element).clipPath)).right
  expect(progress).toBeLessThan(100)
  expect(progress).toBeGreaterThan(-10)
  await page.screenshot({ path: info.outputPath('card-500.png') })
  await page.clock.runFor(350)
  expect(inset(await card.evaluate(element => getComputedStyle(element).clipPath)).right).toBe(-10)
  await page.screenshot({ path: info.outputPath('card-850.png') })

  await page.keyboard.press('Escape')
  await page.clock.runFor(400)

  const second = page.getByRole('button', { name: '第 2 页', exact: true })
  await second.click()
  const sweep = await second.evaluate(element => {
    const animations = element.getAnimations({ subtree: true }).filter(animation => animation instanceof CSSAnimation && animation.animationName === 'page-sweep')
    for (const animation of animations) { animation.pause(); animation.currentTime = 160 }
    return { count: animations.length, clip: getComputedStyle(element, '::before').clipPath, background: getComputedStyle(element).backgroundColor }
  })
  expect(sweep.count).toBe(2)
  expect(inset(sweep.clip).top).toBeGreaterThan(0)
  expect(inset(sweep.clip).top).toBeLessThan(100)
  expect(sweep.background).toBe('rgb(246, 246, 246)')
})

test('directory native animation reveals the menu from top to bottom', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/log/')
  await page.getByRole('button', { name: '目录', exact: true }).click()
  const menu = page.locator('.directory-list')
  await expect.poll(() => menu.evaluate(element => element.getAnimations().length)).toBeGreaterThan(0)
  const frames = await menu.evaluate(element => {
    const animation = element.getAnimations()[0]
    animation.pause()
    const values = [0, 120, 320].map(time => {
      animation.currentTime = time
      return getComputedStyle(element).clipPath
    })
    animation.finish()
    return values
  })
  expect(inset(frames[0]).bottom).toBe(100)
  expect(inset(frames[1]).bottom).toBeGreaterThan(-5)
  expect(inset(frames[1]).bottom).toBeLessThan(100)
  expect(inset(frames[2]).bottom).toBe(-5)
  await expect(menu).toHaveCSS('opacity', '1')
  await expect(menu).toHaveCSS('transform', 'none')
})
