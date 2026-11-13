import type { Page } from '@playwright/test'

export type ContourCanvas = HTMLCanvasElement & { contourPixels?: number[]; contourHeights?: number[]; contourDraws?: number }

export async function installContourProbe(page: Page, pixels = true) {
  await page.addInitScript(pixels => {
    const draw = WebGL2RenderingContext.prototype.drawArrays
    WebGL2RenderingContext.prototype.drawArrays = function(mode, first, count) {
      draw.call(this, mode, first, count)
      const canvas = this.canvas as ContourCanvas
      if (!canvas.parentElement?.classList.contains('contour-field')) return
      const heightPass = Boolean(this.getParameter(this.FRAMEBUFFER_BINDING))
      if (!heightPass) canvas.contourDraws = (canvas.contourDraws ?? 0) + 1
      if (!pixels) return
      const viewport = this.getParameter(this.VIEWPORT) as Int32Array
      const data = new Uint8Array(viewport[2] * viewport[3] * 4)
      this.readPixels(0, 0, viewport[2], viewport[3], this.RGBA, this.UNSIGNED_BYTE, data)
      if (heightPass) canvas.contourHeights = Array.from(data)
      else canvas.contourPixels = Array.from(data)
    }
  }, pixels)
}
