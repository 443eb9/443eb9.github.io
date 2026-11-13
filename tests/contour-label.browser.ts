import { expect, test } from '@playwright/test'

test('island labels grow on one line', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/log/')
  await page.evaluate(() => document.fonts.ready)
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
