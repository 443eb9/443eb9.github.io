import { expect, test } from '@playwright/test'

test('text scan has blank, diffusion, settled and clear phases with a second role', async ({ page }, info) => {
  const time = new Date('2026-11-12T08:00:00Z')
  await page.clock.install({ time })
  await page.clock.pauseAt(time)
  await page.goto('/')
  await page.evaluate(() => document.fonts.ready)
  await page.clock.runFor(16)
  const text = page.locator('.scan-text')
  await expect(text).toHaveAttribute('data-phase', 'blank')
  let elapsed = 16
  let firstClearEdge = 0
  for (const target of [1080, 1180, 1260, 1420, 1720, 2050, 5750, 6200, 6500, 6650, 8650]) {
    await page.clock.runFor(target - elapsed)
    elapsed = target
    const box = (await page.locator('.role-area').boundingBox())!
    await page.screenshot({ path: info.outputPath(`scan-${target}.png`), clip: { x: box.x - 24, y: box.y - 24, width: box.width + 48, height: box.height + 48 } })
    if (target === 1260) {
      await expect(text).toHaveAttribute('data-phase', 'entry')
      const edges = await text.evaluate(element => {
        const band = element.querySelector<HTMLElement>('.scan-blue')!
        const front = new DOMMatrix(getComputedStyle(band).transform).a
        const clipped = parseFloat(band.style.clipPath.split(' ').at(-1)!) / 100
        return [front, front * clipped]
      })
      expect(edges[0]).toBeGreaterThan(edges[1])
      expect(edges[1]).toBeGreaterThan(0)
      await expect(text.locator('.scan-paper')).toHaveCount(0)
      expect(await text.locator('.scan-square:visible').count()).toBeGreaterThan(0)
    }
    if (target === 2050) {
      await expect(text).toHaveAttribute('data-phase', 'hold')
      await expect(text.locator('.scan-line')).toHaveText('Anime Illustrator')
      await expect(text.locator('.scan-square')).toHaveCount(0)
    }
    if (target === 5750 || target === 6200 || target === 6500) {
      await expect(text).toHaveAttribute('data-phase', 'clear')
      const state = await text.evaluate(element => {
        const line = element.querySelector<HTMLElement>('.scan-line')!
        return { left: parseFloat(line.style.clipPath.split(' ').at(-1)!), width: line.getBoundingClientRect().width,
          scrambled: Array.from(element.querySelectorAll<HTMLElement>('.scan-ink')).filter(ink => ink.textContent !== ink.dataset.target).length }
      })
      expect(state.left).toBeGreaterThan(0)
      if (target === 5750) { firstClearEdge = state.left; expect(state.scrambled).toBeGreaterThan(0) }
      if (target === 6200) expect(state.left).toBeGreaterThan(firstClearEdge)
      if (target === 6500) expect(Math.abs(state.left - state.width)).toBeLessThan(1)
      await expect(text.locator('.scan-square')).toHaveCount(0)
    }
    if (target === 6650) await expect(text).toHaveAttribute('data-phase', 'blank')
    if (target === 8650) await expect(text.locator('.scan-line')).toHaveText('Software Engineer')
  }
})

test('desktop scale, stripe response, island cards and mobile pagination remain usable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.evaluate(() => document.fonts.ready)
  const large = await page.locator('.avatar').evaluate(element => element.getBoundingClientRect().width)
  expect(large).toBeCloseTo(336, 0)
  await page.setViewportSize({ width: 1188, height: 666 })
  expect(await page.locator('.avatar').evaluate(element => element.getBoundingClientRect().width)).toBeCloseTo(large / 2, 0)
  const stripes = page.locator('.stripe-square path')
  const before = await stripes.evaluateAll(elements => elements.map(element => element.getAttribute('d')).join(''))
  await page.locator('.stripe-square').hover()
  expect(await stripes.evaluateAll(elements => elements.map(element => element.getAttribute('d')).join(''))).not.toBe(before)
  await page.getByRole('link', { name: '日志', exact: true }).click()
  await expect(page.locator('.island')).toHaveCount(7)
  await page.locator('.island-hit').nth(1).click()
  await expect(page.locator('#island-card')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('#island-card')).toHaveCount(0)
  await page.getByRole('button', { name: '目录', exact: true }).click()
  await page.locator('.directory-list button').filter({ hasText: 'Bevy基础渲染（0.13）' }).click()
  await expect(page.locator('.card-date')).toHaveText('long term project')
  await page.setViewportSize({ width: 320, height: 740 })
  const pagination = (await page.locator('.pagination').boundingBox())!
  expect(pagination.x).toBeGreaterThanOrEqual(0)
  expect(pagination.x + pagination.width).toBeLessThanOrEqual(320)
  await page.goto('/')
  await page.evaluate(() => document.fonts.ready)
  const textFit = await page.locator('.role-area').evaluate(element => {
    const context = document.createElement('canvas').getContext('2d')!
    context.font = `${getComputedStyle(element.querySelector('.scan-text')!).fontSize} 'Ark Pixel'`
    return { available: element.clientWidth, needed: Math.max(...['Anime Illustrator', 'Software Engineer'].map(text => context.measureText(text).width)) }
  })
  expect(textFit.needed).toBeLessThanOrEqual(textFit.available)
})

test('gray blocks blink and move while image layers and fixed graphics retain their boundaries', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')
  await page.evaluate(() => document.fonts.ready)
  const block = page.locator('.gray-blocks i').first()
  const blink = await block.evaluate(element => {
    const animation = element.getAnimations()[0]
    animation.pause()
    const duration = Number(animation.effect!.getTiming().duration)
    const values = [25, 75, 125, duration / 2, duration - 25].map(time => {
      animation.currentTime = time
      return getComputedStyle(element).opacity
    })
    return { duration, values, easing: animation.effect!.getTiming().easing }
  })
  expect(blink.values).toEqual(['1', '0', '1', '1', '0'])
  expect(blink.easing).toBe('linear')
  expect(blink.duration).toBeGreaterThanOrEqual(5000)
  expect(blink.duration).toBeLessThanOrEqual(15000)
  const initialLeft = await block.evaluate(element => (element as HTMLElement).style.left)
  await block.evaluate(element => element.getAnimations()[0].finish())
  await expect.poll(() => block.evaluate(element => (element as HTMLElement).style.left)).not.toBe(initialLeft)
  const graphics = await page.evaluate(() => {
    const style = (selector: string) => getComputedStyle(document.querySelector(selector)!)
    return { avatarShadow: style('.avatar').boxShadow, panelShadow: style('.valley').boxShadow,
      railShadow: style('.vertical-rail').boxShadow, tileBorder: style('.tile-stack span').borderLeftWidth,
      blueCorner: style('.stripe-corner-blue').backgroundColor, grayCorner: style('.stripe-corner-gray').backgroundColor,
      cornerWidth: style('.stripe-corner-blue').width,
      junction: getComputedStyle(document.querySelector('.background-grid')!, '::after').backgroundImage,
      base: style('.layer-one .canine').backgroundImage, outline: style('.layer-two .canine-outline').maskImage,
      outlineOpacity: style('.canine-outline').opacity, outlineBlend: style('.canine-outline').mixBlendMode,
      outlineColor: style('.canine-outline').backgroundColor, avatarBorder: style('.avatar').borderLeftWidth,
      stripeBorder: style('.stripe-square').borderLeftWidth, navShadow: style('.home-nav .frame-button').boxShadow,
      squareSizes: Array.from(document.querySelectorAll('.gray-blocks i'), element => { const box = element.getBoundingClientRect(); return [box.width, box.height] }),
      edgeImages: ['top', 'right', 'bottom', 'left'].map(edge => style(`.stripe-edge-${edge}`).backgroundImage),
      captionGap: document.querySelector('.valley .panel-label')!.getBoundingClientRect().left - document.querySelector('.valley .corner-0')!.getBoundingClientRect().right }
  })
  expect([graphics.avatarShadow, graphics.panelShadow, graphics.railShadow]).toEqual(['none', 'none', 'none'])
  expect(graphics.tileBorder).toBe('3px')
  expect(graphics.blueCorner).toBe('rgb(70, 100, 244)')
  expect(graphics.grayCorner).toBe('rgb(211, 211, 211)')
  expect(graphics.cornerWidth).toBe('52px')
  expect(graphics.junction).toMatch(/^url\(/)
  expect(graphics.base).toContain('canine.png')
  expect(graphics.outline).toContain('canine-outline.png')
  expect(graphics.outlineOpacity).toBe('1')
  expect(graphics.outlineBlend).toBe('normal')
  const color = await page.evaluate(value => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 1
    const context = canvas.getContext('2d')!
    context.fillStyle = value
    context.fillRect(0, 0, 1, 1)
    return Array.from(context.getImageData(0, 0, 1, 1).data)
  }, graphics.outlineColor)
  expect(color).toEqual([194, 204, 251, 255])
  expect(graphics.avatarBorder).toBe('5px')
  expect(graphics.stripeBorder).toBe('4px')
  expect(graphics.navShadow).toMatch(/\) 0px /)
  expect(graphics.captionGap).toBeGreaterThan(15)
  expect(graphics.edgeImages[0]).toBe(graphics.edgeImages[2])
  expect(graphics.edgeImages[1]).toBe(graphics.edgeImages[3])
  for (const [width, height] of graphics.squareSizes) expect(width).toBeCloseTo(height, 1)
  const rail = await page.locator('.left-rail').screenshot({ path: info.outputPath('left-rail.png') })
  const seam = await page.evaluate(async source => {
    const image = new Image()
    image.src = `data:image/png;base64,${source}`
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const context = canvas.getContext('2d')!
    context.drawImage(image, 0, 0)
    const data = context.getImageData(4, 100, 6, 1).data
    return Array.from({ length: 6 }, (_, i) => [data[i * 4], data[i * 4 + 1]])
  }, rail.toString('base64'))
  expect(seam.every(([red, green]) => red < 230 && green < 230)).toBe(true)
  await expect(page.locator('.top-rail > i')).toHaveCount(2)
  await expect(page.locator('.top-rail .corners')).toHaveCount(0)
  await expect(page.locator('.avatar')).toHaveAttribute('src', '/images/avatar-original.png')
  await page.screenshot({ path: info.outputPath('home-graphics.png') })
})
