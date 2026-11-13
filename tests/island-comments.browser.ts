import { expect, test } from '@playwright/test'

for (const width of [390, 1188]) {
  test(`comments follow short and long island bodies at ${width}px`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize({ width, height: 900 })
    await page.route('https://giscus.app/**', route => route.fulfill({ contentType: 'text/html', body: '<html><body>Comments</body></html>' }))

    for (const id of [1, 14]) {
      await page.goto(`/island/${id}`)
      const scroll = page.getByRole('region', { name: '岛屿正文', exact: true })
      const comments = page.getByRole('region', { name: '评论', exact: true })
      await expect(comments.locator('giscus-widget')).toHaveCount(0)
      const layout = await scroll.evaluate(element => {
        const body = element.querySelector('.detail-article-content')!.getBoundingClientRect()
        const comments = element.querySelector('.island-comments')!.getBoundingClientRect()
        return { bodyWidth: body.width, commentsWidth: comments.width, gap: comments.top - body.bottom, commentsTop: comments.top, scrollBottom: element.getBoundingClientRect().bottom }
      })
      expect(layout.commentsWidth).toBeCloseTo(layout.bodyWidth, 2)
      expect(layout.gap).toBeGreaterThanOrEqual(32)
      expect(layout.commentsTop).toBeGreaterThanOrEqual(layout.scrollBottom)

      await scroll.evaluate(element => {
        const body = element.querySelector<HTMLElement>('.detail-article-content')!
        const style = getComputedStyle(element)
        element.scrollTop = body.offsetHeight + parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) - element.clientHeight
      })
      await expect(comments.locator('giscus-widget')).toHaveCount(0)
      await scroll.hover()
      await page.mouse.wheel(0, 600)
      await expect(comments.locator('giscus-widget')).toHaveCount(1)
      const frame = comments.locator('iframe')
      await expect(frame).toHaveAttribute('src', /https:\/\/giscus\.app\/zh-CN\/widget\?/)
      expect(await page.evaluate(() => window.scrollY)).toBe(0)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    }
  })
}

test('legacy comments use the original repository, category and discussion titles', async ({ page }) => {
  await page.route('https://giscus.app/**', route => route.fulfill({ contentType: 'text/html', body: '<html><body>Comments</body></html>' }))
  for (const [id, title] of [[1, '梦开始的地方'], [6, '从零开始的渲染引擎-Aurora Chapter 0'], [24, 'Krenz 构成 13 期'], [39, 'Tenten 人体结构&光影二合一 13 期'], [41, '色彩心得']] as const) {
    await page.goto(`/island/${id}`)
    await page.locator('.detail-scroll').evaluate(element => { element.scrollTop = element.scrollHeight })
    const frame = page.locator('.island-comments iframe')
    await expect(frame).toHaveAttribute('src', /\/widget\?/)
    const url = new URL((await frame.getAttribute('src'))!)
    expect(url.searchParams.get('repo')).toBe('443eb9/crepuscular-archipelago')
    expect(url.searchParams.get('repoId')).toBe('R_kgDOLyot2Q')
    expect(url.searchParams.get('category')).toBe('Giscus')
    expect(url.searchParams.get('categoryId')).toBe('DIC_kwDOLyot2c4Cf7i_')
    expect(url.searchParams.get('term')).toBe(`${title} - Crepuscular Archipelago`)
    expect(url.searchParams.get('strict')).toBe('1')
  }
})
