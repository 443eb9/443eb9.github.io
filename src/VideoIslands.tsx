import { useEffect, useRef, type RefObject } from 'react'
import type { MotionValue } from 'motion/react'
import { ISLAND_GRID_WIDTH, type logGrid } from './log-layout'
import { createVideoGridRenderer } from './video-grid'

export function VideoIslands({ video, grid, unit, panX, panY }: { video: RefObject<HTMLVideoElement | null>; grid: ReturnType<typeof logGrid>; unit: number; panX: MotionValue<number>; panY: MotionValue<number> }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const { size, x, y } = grid

  useEffect(() => {
    const element = canvas.current!
    const media = video.current
    if (!media) return
    const renderer = createVideoGridRenderer(element)
    let ready = false
    function paint() {
      if (ready && media!.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) renderer.draw(media!, { x: panX.get(), y: panY.get() })
    }
    const observer = new ResizeObserver(([entry]) => {
      const style = getComputedStyle(element)
      const foreground = style.color.match(/[\d.]+/g)!.map(Number)
      const background = style.stroke.match(/[\d.]+/g)!.map(Number)
      renderer.resize(entry.contentRect.width, entry.contentRect.height, { size, x, y }, unit, ISLAND_GRID_WIDTH, foreground, background)
      ready = true
      paint()
    })
    observer.observe(element)

    let frame = 0
    function nextFrame() {
      paint()
      frame = media!.requestVideoFrameCallback(nextFrame)
    }
    frame = media.requestVideoFrameCallback(nextFrame)
    media.addEventListener('seeked', paint)
    return () => {
      media.cancelVideoFrameCallback(frame)
      media.removeEventListener('seeked', paint)
      observer.disconnect()
      renderer.dispose()
    }
  }, [video, size, x, y, unit, panX, panY])

  return <canvas ref={canvas} className="terrain-map video-islands" role="img" aria-label="Bad Apple 岛屿方块影像" />
}
