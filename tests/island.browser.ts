import { expect, test } from '@playwright/test'
import islands from '../src/generated/islands.json' with { type: 'json' }
import { islandPath } from '../src/island-content'

test('log cards open island content and return through the existing wipe', async ({ page }) => {
  await page.goto('/log')
  const tile = page.locator('.island-hit').first()
  await tile.click()
  const link = page.getByRole('link', { name: `阅读 ${islands[0].title}`, exact: true })
  await expect(link).toHaveAttribute('href', islandPath(islands[0].id))
  await expect(link).toBeVisible()
  await page.waitForTimeout(900)
  await link.click()
  await expect(page.locator('.page-wipe')).toBeVisible()
  await expect(page.locator('.page-wipe')).toHaveCount(0)
  await expect(page).toHaveURL(islandPath(islands[0].id))
  await expect(page.locator('.detail-summary h1')).toHaveText(islands[0].title)
  await expect(page.locator('.detail-caption')).toHaveText('// Island #01')
  await expect(page).toHaveTitle(`${islands[0].title} · Crepuscular Archipelago`)
  await page.getByRole('link', { name: '返回日志', exact: true }).click()
  await expect(page.locator('.page-wipe')).toBeVisible()
  await expect(page.locator('.page-wipe')).toHaveCount(0)
  await expect(page).toHaveURL('/log')
  await page.goBack()
  await expect(page.locator('.detail-body')).toBeVisible()
})

for (const width of [320, 390, 2000, 2800]) {
  test(`Markdown and layout at ${width}px with a direct route and reload`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1124 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const island = islands.find(island => island.id.startsWith('14/'))!
    await page.goto(islandPath(island.id))
    await page.reload()
    await expect(page.locator('.island-markdown h1').first()).toBeVisible()
    await expect(page.locator('.island-markdown pre').first()).toBeVisible()
    await expect(page.locator('.island-markdown a').first()).toHaveAttribute('href', /^https:/)
    const bounds = await page.locator('.detail-body').boundingBox()
    expect(bounds!.width).toBeLessThanOrEqual(800)
    if (width === 2000) {
      expect(bounds!.x).toBeCloseTo(642, 0)
      expect(bounds!.width).toBeCloseTo(788, 0)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    await expect(page.locator('.island-backdrop canvas')).toHaveCount(1)
    const scroll = page.getByRole('region', { name: '岛屿正文', exact: true })
    await scroll.hover()
    await page.mouse.wheel(0, 600)
    await expect.poll(() => scroll.evaluate(element => element.scrollTop)).toBeGreaterThan(0)
    expect(await page.locator('.detail-body').boundingBox()).toEqual(bounds)
    expect(await page.evaluate(() => window.scrollY)).toBe(0)
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(1124)
    await scroll.evaluate(element => { element.scrollTop = element.scrollHeight })
    await page.mouse.wheel(0, 600)
    expect(await page.evaluate(() => window.scrollY)).toBe(0)
    await expect(page.locator('.island-silhouette')).toHaveCSS('transform', 'matrix(-1, 0, 0, 1, 0, 0)')
  })
}

test('Markdown images load from the source document directory', async ({ page }) => {
  await page.goto('/island/11')
  const image = page.locator('.island-markdown img').first()
  await expect(image).toHaveAttribute('src', '/island-assets/11/11/work.avif')
  await expect.poll(() => image.evaluate(element => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
  await page.reload()
  await expect.poll(() => image.evaluate(element => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
})

for (const id of ['22/practice.md', '27/anatomy-and-sketch.md']) {
  test(`marked private content stays ciphertext for ${id}`, async ({ page }) => {
    await page.goto(islandPath(id))
    const ciphertext = page.getByLabel('AES 加密内容')
    await expect(ciphertext).toBeVisible()
    await expect(ciphertext).toHaveAttribute('data-encryption-context', `island:${id}:section:0`)
    await expect(ciphertext).toHaveText(/^[A-Za-z0-9+/]+=*$/)
    await expect(page.locator('.island-markdown img')).toHaveCount(0)
    await expect(page.locator('.island-markdown h1')).toHaveCount(0)
  })
}

test('full-page contour buffers use CSS pixels on a high-DPI screen', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2, reducedMotion: 'reduce' })
  try {
    const page = await context.newPage()
    for (const path of ['/metadata', '/island/14']) {
      await page.goto(path)
      const canvas = page.locator('.contour-field canvas')
      await expect(canvas).toHaveCount(1)
      await expect.poll(() => canvas.evaluate(element => ({ width: (element as HTMLCanvasElement).width, height: (element as HTMLCanvasElement).height }))).toEqual({ width: 1920, height: 1080 })
    }
  } finally {
    await context.close()
  }
})

test('unknown island shows the return link', async ({ page }) => {
  await page.goto('/island/999999')
  await expect(page.getByRole('heading', { name: /404/ })).toBeVisible()
  await expect(page.getByRole('link', { name: '返回日志' })).toHaveAttribute('href', '/log')
})
