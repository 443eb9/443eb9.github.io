import { useEffect, useId, useRef, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { contours } from 'd3-contour'
import { createNoise3D } from 'simplex-noise'
import { randomSource } from './terrain'
import { createHalftone } from './halftone'

export function Contours({ variant = 0, frameRate = 10, scale = 0.95 }: { variant?: number; frameRate?: number; scale?: number }) {
  const paths = useRef<SVGGElement>(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    const noise = createNoise3D(randomSource(107 + variant))
    const generator = contours().size([64, 40]).thresholds([-0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6])
    const frameInterval = 1000 / frameRate
    let frame = 0
    let last = -frameInterval
    let aspect = 1.6
    const observer = new ResizeObserver(([entry]) => {
      aspect = entry.contentRect.width / entry.contentRect.height
      last = -frameInterval
      if (reduced) draw(0)
    })
    observer.observe(paths.current!.ownerSVGElement!)
    function draw(now: number) {
      if (now - last >= frameInterval) {
        last = now - (now - last) % frameInterval
        const time = reduced ? 0 : now * 0.00002
        const values = Array.from({ length: 64 * 40 }, (_, i) => noise((i % 64) / 64 * aspect * scale + variant, Math.floor(i / 64) / 40 * scale, time))
        const children = paths.current?.children
        generator(values).forEach((contour, index) => {
          const d = contour.coordinates.flatMap(polygon => polygon.map(ring => {
            const points = ring.slice(0, -1)
            const first = points[0]
            const end = points[points.length - 1]
            let path = `M${((first[0] + end[0]) / 2).toFixed(3)},${((first[1] + end[1]) / 2).toFixed(3)}`
            points.forEach((point, i) => {
              const next = points[(i + 1) % points.length]
              path += `Q${point[0].toFixed(3)},${point[1].toFixed(3)} ${((point[0] + next[0]) / 2).toFixed(3)},${((point[1] + next[1]) / 2).toFixed(3)}`
            })
            return `${path}Z`
          })).join('')
          children?.[index]?.setAttribute('d', d)
        })
      }
      if (!reduced) frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => { observer.disconnect(); cancelAnimationFrame(frame) }
  }, [variant, frameRate, scale, reduced])

  return <svg className="contour-field" viewBox="0 0 64 40" preserveAspectRatio="none" aria-hidden="true">
    <g ref={paths} fill="none" stroke="currentColor" strokeWidth="0.32">{Array.from({ length: 7 }, (_, i) => <path key={i} />)}</g>
  </svg>
}

export function NoiseField({ kind }: { kind: 'canine' | 'sea' }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    const canvas = ref.current!
    const context = canvas.getContext('2d')!
    const scene = canvas.closest<HTMLElement>('.scene')!
    const noise = createNoise3D(randomSource(443))
    const speed = 0.00018
    const frameInterval = 1000 / (kind === 'sea' ? 60 : 24)
    let image: ImageData
    let render: ReturnType<typeof createHalftone>
    let frame = 0
    let last = -frameInterval
    let pointer = { x: -10000, y: -10000 }
    const observer = new ResizeObserver(([entry]) => {
      canvas.width = Math.ceil(entry.contentRect.width)
      canvas.height = Math.ceil(entry.contentRect.height)
      const unit = Math.max(0.75, scene.clientWidth / 1188)
      image = context.createImageData(canvas.width, canvas.height)
      render = createHalftone(image, noise, kind, unit)
      last = -frameInterval
      if (reduced) draw(0)
    })
    observer.observe(canvas)

    function move(event: PointerEvent) {
      const bounds = canvas.getBoundingClientRect()
      pointer = { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
      if (reduced) draw(0)
    }
    function leave() {
      pointer = { x: -10000, y: -10000 }
      if (reduced) draw(0)
    }
    scene.addEventListener('pointermove', move)
    scene.addEventListener('pointerleave', leave)

    function draw(now: number) {
      if (image && (now - last >= frameInterval || reduced)) {
        last = now - (now - last) % frameInterval
        render(reduced ? 0 : now * speed, pointer)
        context.putImageData(image, 0, 0)
      }
      if (!reduced) frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
      scene.removeEventListener('pointermove', move)
      scene.removeEventListener('pointerleave', leave)
    }
  }, [kind, reduced])

  return <canvas ref={ref} className="noise-field" aria-hidden="true" />
}

export function Corners({ seed = 0 }: { seed?: number }) {
  const id = useId()
  const [filled] = useState(() => {
    const random = randomSource(seed + Math.floor(Math.random() * 4294967296))
    return Array.from({ length: 4 }, () => random() < 0.5)
  })
  return <span className="corners" aria-hidden="true">{[0, 1, 2, 3].map(i => <span key={`${id}-${i}`} className={`corner corner-${i} ${filled[i] ? 'filled' : ''}`} />)}</span>
}
