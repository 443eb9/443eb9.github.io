import { expect, test } from '@playwright/test'

test('navigation reveals the new page left of the blue bar and supports history and reduced motion', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  const time = new Date('2026-11-12T08:00:00Z')
  await page.clock.install({ time })
  await page.clock.pauseAt(time)
  await page.setViewportSize({ width: 1188, height: 666 })
  await page.goto('/')
  await page.evaluate(() => { document.body.dataset.navigationProbe = 'same-document'; return document.fonts.ready })
  await page.clock.runFor(100)
  await page.getByRole('link', { name: '日志', exact: true }).click()
  const seek = (time: number) => page.locator('.page-incoming, .page-incoming > .page-content, .page-wipe').evaluateAll((elements, time) => {
    for (const element of elements) for (const animation of element.getAnimations()) { animation.pause(); animation.currentTime = time }
  }, time)
  const finish = () => page.locator('.page-incoming, .page-incoming > .page-content, .page-wipe').evaluateAll(elements => {
    for (const element of elements) for (const animation of element.getAnimations()) animation.finish()
  })
  await seek(100)
  const earlyWidth = await page.locator('.page-wipe').evaluate(element => element.getBoundingClientRect().width)
  await seek(330)
  await expect(page).toHaveURL(/\/log$/)
  await expect(page.locator('.page-outgoing .home')).toHaveCount(1)
  await expect(page.locator('.page-incoming .log')).toHaveCount(1)
  const wipe = await page.evaluate(() => {
    const band = document.querySelector('.page-wipe')!.getBoundingClientRect()
    const incoming = document.querySelector('.page-incoming')!
    const edge = incoming.getBoundingClientRect().right
    const contentLeft = incoming.firstElementChild!.getBoundingClientRect().left
    return { left: band.left, width: band.width, height: band.height, edge, contentLeft, inert: incoming.hasAttribute('inert') }
  })
  expect(wipe.left).toBeGreaterThan(0)
  expect(wipe.left).toBeLessThan(1188)
  const progress = (wipe.left / 1188 * 100 + 8) / 108
  expect(wipe.width).toBeCloseTo(1188 * 0.08 * (1 + 9 * progress ** 2), 1)
  expect(wipe.width).toBeGreaterThan(earlyWidth)
  expect(wipe.height).toBe(666)
  expect(wipe.edge).toBeCloseTo(wipe.left, 1)
  expect(wipe.contentLeft).toBeCloseTo(0, 1)
  expect(wipe.inert).toBe(true)
  await page.screenshot({ path: info.outputPath('navigation-middle.png') })
  await seek(620)
  const lateWidth = await page.locator('.page-wipe').evaluate(element => element.getBoundingClientRect().width)
  expect(lateWidth).toBeGreaterThan(wipe.width)
  expect(lateWidth / (1188 * 0.08)).toBeGreaterThan(9.6)
  expect(lateWidth / (1188 * 0.08)).toBeLessThanOrEqual(10)
  await finish()
  await expect(page.locator('.page-wipe')).toHaveCount(0)
  await expect(page.locator('.home')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '目录', exact: true })).toBeVisible()
  expect(await page.locator('body').getAttribute('data-navigation-probe')).toBe('same-document')

  await page.goBack()
  await expect(page.locator('.page-wipe')).toHaveCount(1)
  await finish()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.locator('.home')).toHaveCount(1)
  await expect(page.locator('.log')).toHaveCount(0)
  await expect(page).toHaveTitle('Crepuscular Archipelago · 443eb9#C')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.getByRole('link', { name: '日志', exact: true }).click()
  await expect(page.locator('.log')).toHaveCount(1)
  await expect(page.locator('.page-wipe')).toHaveCount(0)
  await expect(page.locator('.home')).toHaveCount(0)
})
