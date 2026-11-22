import { expect, test } from '@playwright/test'
import roadmap from '../src/roadmap.json' with { type: 'json' }

test('roadmap opens directly and filters tasks without removing milestones', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const response = await page.goto('/lapiz/roadmap/')
  expect(response?.status()).toBe(200)
  expect(await response?.text()).toContain('<title>Lapiz 路线图 · Crepuscular Archipelago</title>')
  await expect(page.getByRole('heading', { name: 'Lapiz 开发路线图' })).toBeVisible()

  for (const stage of roadmap) {
    const section = page.getByRole('region', { name: stage.version })
    await expect(section.getByRole('listitem')).toHaveCount(stage.tasks.length)
    await expect(section.getByRole('heading', { name: stage.tasks[0].title, exact: true })).toBeVisible()
    await expect(section.getByText(stage.tasks[0].description, { exact: true })).toBeVisible()
  }

  for (const [status, label] of [['completed', '已完成'], ['in_progress', '进行中'], ['todo', '待办']]) {
    const button = page.getByRole('button', { name: new RegExp(label) })
    await button.click()
    await expect(button).toHaveAttribute('aria-pressed', 'true')
    for (const stage of roadmap) {
      const section = page.getByRole('region', { name: stage.version })
      const tasks = stage.tasks.filter(task => task.status === status)
      await expect(section.getByRole('listitem')).toHaveCount(tasks.length)
      await expect(section.getByText(label, { exact: true })).toHaveCount(tasks.length)
      if (!tasks.length) await expect(section.getByText('这个阶段没有符合条件的任务', { exact: true })).toBeVisible()
    }
  }

  await page.getByRole('button', { name: /全部/ }).click()
  await expect(page.getByRole('listitem')).toHaveCount(roadmap.flatMap(stage => stage.tasks).length)
})

test('roadmap backdrop covers the viewport and creates new square clusters on reload', async ({ page }) => {
  const viewport = { width: 1440, height: 900 }
  await page.setViewportSize(viewport)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/lapiz/roadmap')
  const canvas = page.locator('.lapiz-backdrop canvas')
  await expect(canvas).toBeVisible()
  await expect(page.locator('.lapiz-chart')).toHaveCount(0)
  await page.locator('.lapiz-footer').scrollIntoViewIfNeeded()
  expect(await canvas.boundingBox()).toEqual({ x: 0, y: 0, ...viewport })

  const clusters = page.locator('.lapiz-square-cluster')
  await expect(clusters).toHaveCount(9)
  const readLayout = () => clusters.evaluateAll(elements => elements.map(cluster => {
    const anchor = cluster.getBoundingClientRect()
    return {
      x: anchor.x,
      y: anchor.y,
      squares: Array.from(cluster.children, square => {
        const box = square.getBoundingClientRect()
        return { x: box.x + box.width / 2 - anchor.x, y: box.y + box.height / 2 - anchor.y, width: box.width, height: box.height }
      }),
    }
  }))
  const initial = await readLayout()
  for (const { squares } of initial) {
    expect(squares.length).toBeGreaterThanOrEqual(1)
    expect(squares.length).toBeLessThanOrEqual(3)
    for (const { x, y, width, height } of squares) {
      expect(Math.hypot(x, y)).toBeLessThanOrEqual(56.05)
      expect(width).toBeGreaterThanOrEqual(9)
      expect(width).toBeLessThanOrEqual(36)
      expect(width).toBe(height)
    }
  }

  await page.getByRole('button', { name: /进行中/ }).click()
  expect(await readLayout()).toEqual(initial)
  await page.reload()
  await expect(clusters).toHaveCount(9)
  const refreshed = await readLayout()
  expect(refreshed.map(({ x, y }) => [x, y])).not.toEqual(initial.map(({ x, y }) => [x, y]))
  expect(refreshed.flatMap(({ squares }) => squares.map(({ width }) => width))).not.toEqual(initial.flatMap(({ squares }) => squares.map(({ width }) => width)))
})

test('roadmap fits a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await page.goto('/lapiz/roadmap')
  await page.evaluate(() => document.fonts.ready)
  await expect(page.getByRole('heading', { name: 'Lapiz 开发路线图' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320)
  await expect(page.getByRole('link', { name: '返回顶部' })).toHaveCount(0)
})
