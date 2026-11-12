import { useEffect, useId, useRef } from 'react'
import { useReducedMotion } from 'motion/react'
import { contours } from 'd3-contour'
import { createNoise3D } from 'simplex-noise'
import { randomSource } from './terrain'

export function Contours({ variant = 0 }: { variant?: number }) {
  const paths = useRef<SVGGElement>(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    const noise = createNoise3D(randomSource(107 + variant))
    const generator = contours().size([48, 32]).thresholds([-0.55, -0.3, -0.05, 0.2, 0.45])
    let frame = 0
    let last = -Infinity
    function draw(now: number) {
      if (now - last >= 100) {
        last = now
        const time = reduced ? 0 : now * 0.000035
        const values = Array.from({ length: 48 * 32 }, (_, i) => noise((i % 48) / 24 + variant, Math.floor(i / 48) / 24, time))
        const geometry = generator(values)
        const children = paths.current?.children
        geometry.forEach((contour, index) => {
          const d = contour.coordinates.flatMap(polygon => polygon.map(ring => `M${ring.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join('L')}Z`)).join('')
          children?.[index]?.setAttribute('d', d)
        })
      }
      if (!reduced) frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [variant, reduced])

  return <svg className="contour-field" viewBox="0 0 48 32" preserveAspectRatio="none" aria-hidden="true">
    <g ref={paths} fill="none" stroke="currentColor" strokeWidth="0.22">{Array.from({ length: 5 }, (_, i) => <path key={i} />)}</g>
  </svg>
}

export function NoiseField({ dense = false }: { dense?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    const canvas = ref.current!
    const context = canvas.getContext('2d')!
    const noise = createNoise3D(randomSource(443))
    let width = 0
    let height = 0
    let frame = 0
    let last = -Infinity
    let pointer = { x: -1000, y: -1000 }
    const observer = new ResizeObserver(([entry]) => {
      width = entry.contentRect.width
      height = entry.contentRect.height
      canvas.width = Math.round(width)
      canvas.height = Math.round(height)
      last = -Infinity
      if (reduced) draw(0)
    })
    observer.observe(canvas)
    const parent = canvas.parentElement!
    function move(event: PointerEvent) {
      const bounds = canvas.getBoundingClientRect()
      pointer = { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
      if (reduced) draw(0)
    }
    function leave() {
      pointer = { x: -1000, y: -1000 }
      if (reduced) draw(0)
    }
    parent.addEventListener('pointermove', move)
    parent.addEventListener('pointerleave', leave)

    function draw(now: number) {
      if (now - last >= 85 || reduced) {
        last = now
        context.clearRect(0, 0, width, height)
        const time = reduced ? 0 : now * 0.00012
        context.fillStyle = dense ? '#4960ff88' : '#4960ff38'
        for (let y = 2; y < height; y += 6) {
          for (let x = 2; x < width; x += 6) {
            const value = (noise(x / 280, y / 280, time) + 1) / 2
            const falloff = Math.max(0, 1 - Math.hypot(x - pointer.x, y - pointer.y) / 190)
            const radius = Math.max(0.2, value * (dense ? 1.65 : 1.3) + falloff * 1.6)
            context.beginPath()
            context.arc(x + (Math.round(y / 6) % 2) * 3, y, radius, 0, Math.PI * 2)
            context.fill()
          }
        }
      }
      if (!reduced) frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
      parent.removeEventListener('pointermove', move)
      parent.removeEventListener('pointerleave', leave)
    }
  }, [dense, reduced])

  return <canvas ref={ref} className="noise-field" aria-hidden="true" />
}

export function Corners({ seed = 0 }: { seed?: number }) {
  const id = useId()
  return <span className="corners" aria-hidden="true">{[0, 1, 2, 3].map(i => <span key={`${id}-${i}`} className={`corner corner-${i} ${(seed * 7 + i * 3) % 4 < 2 ? 'filled' : ''}`} />)}</span>
}
