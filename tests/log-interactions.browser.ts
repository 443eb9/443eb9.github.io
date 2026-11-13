import { expect, test, type Page } from '@playwright/test'

async function blankPoint(page: Page) {
  return page.locator('.island-map').evaluate(element => {
    const bounds = element.getBoundingClientRect()
    for (let y = 120; y < bounds.height - 120; y += 30) {
      for (let x = 20; x < bounds.width - 20; x += 30) {
        const target = document.elementFromPoint(bounds.left + x, bounds.top + y)
        if (target && element.contains(target) && !target.closest('.island, .selection')) return { x: bounds.left + x, y: bounds.top + y }
      }
    }
    throw new Error('A blank map position is required')
  })
}

test('measured title labels and their corners stay separated on every log page', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.clock.setFixedTime(new Date('2026-11-13T08:00:00Z'))
  for (const width of [390, 1188, 2376]) {
    await page.setViewportSize({ width, height: width > 800 ? Math.round(width * 666 / 1188) : 740 })
    await page.goto('/log/')
    await page.evaluate(() => document.fonts.ready)
    while (true) {
      await expect.poll(() => page.locator('.island:not([inert]) .island-title').evaluateAll(elements => {
        const bounds = elements.map(element => element.getBoundingClientRect())
        const unit = parseFloat(getComputedStyle(elements[0]).getPropertyValue('--u'))
        return bounds.flatMap((box, index) => bounds.slice(index + 1).filter(other => {
          const gapX = Math.max(box.left - other.right, other.left - box.right)
          const gapY = Math.max(box.top - other.bottom, other.top - box.bottom)
          return gapX < 16 * unit - 0.1 && gapY < 16 * unit - 0.1
        })).length
      })).toBe(0)
      const next = page.getByRole('button', { name: '下一页', exact: true })
      if (await next.isDisabled()) break
      await next.click()
    }
  }
})

test('blank clicks close a card while map drags and note body clicks preserve it', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1188, height: 740 })
  await page.goto('/log/')
  await page.evaluate(() => document.fonts.ready)
  await page.getByRole('button', { name: '目录', exact: true }).click()
  await page.locator('.directory-list button').first().click()
  const card = page.locator('#island-card')
  await expect(card).toBeVisible()
  await card.locator('.card-body').click()
  await expect(card).toBeVisible()

  const start = await blankPoint(page)
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x + 70, start.y + 60, { steps: 10 })
  await page.mouse.up()
  await expect(card).toBeVisible()

  const blank = await blankPoint(page)
  await page.mouse.click(blank.x, blank.y)
  await expect(card).toHaveCount(0)
  await expect(page.locator('.island.selected')).toHaveCount(0)
})
