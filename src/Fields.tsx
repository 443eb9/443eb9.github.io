import { useEffect, useId, useRef, useState } from 'react'
import { type MotionValue, useReducedMotion } from 'motion/react'
import { createNoise3D } from 'simplex-noise'
import { randomSource } from './terrain'
import { createHalftone } from './halftone'
import { createSeaRenderer } from './sea'
import type { ContourRequest, ContourResponse } from './contours.worker'

const NOISE_SPEED = 0.00018

export function Contours({ variant = 0, frameRate = 10, scale = 0.95 }: { variant?: number; frameRate?: number; scale?: number }) {
  const paths = useRef<SVGGElement>(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    const worker = new Worker(new URL('./contours.worker.ts', import.meta.url), { type: 'module' })
    let pending = false
    let first = true
    let dirty = true
    const svg = paths.current!.ownerSVGElement!
    const scene = svg.closest<HTMLElement>('.scene')!
    let pointer: { x: number; y: number } | null = null
    const frameInterval = 1000 / frameRate
    let frame = 0
    let last = -frameInterval
    let aspect = 1.6
    const observer = new ResizeObserver(([entry]) => {
      aspect = entry.contentRect.width / entry.contentRect.height
      last = -frameInterval
      dirty = true
      if (reduced) request(0)
    })
    observer.observe(svg)
    worker.onmessage = ({ data }: MessageEvent<ContourResponse>) => {
      data.paths.forEach((path, index) => paths.current!.children[index].setAttribute('d', path))
      pending = false
      if (reduced && dirty) request(0)
    }

    function move(event: PointerEvent) {
      pointer = { x: event.clientX, y: event.clientY }
      dirty = true
      if (reduced) request(0)
    }
    function leave() {
      pointer = null
      dirty = true
      if (reduced) request(0)
    }
    scene.addEventListener('pointermove', move)
    scene.addEventListener('pointerleave', leave)

    function request(now: number) {
      if (pending) return
      pending = true
      dirty = false
      last = now - (now - last) % frameInterval
      const bounds = svg.getBoundingClientRect()
      const radius = 130 * Math.max(0.75, scene.clientWidth / 1188)
      worker.postMessage({
        aspect,
        time: reduced ? 0 : now * 0.00002,
        pointer: pointer && bounds.width > 0 && bounds.height > 0 ? {
          x: (pointer.x - bounds.left) / bounds.width * 64,
          y: (pointer.y - bounds.top) / bounds.height * 40,
          radiusX: radius / bounds.width * 64,
          radiusY: radius / bounds.height * 40,
        } : null,
        settings: first ? { variant, scale } : undefined,
      } satisfies ContourRequest)
      first = false
    }
    function draw(now: number) {
      if (now - last >= frameInterval) request(now)
      if (!reduced) frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
      scene.removeEventListener('pointermove', move)
      scene.removeEventListener('pointerleave', leave)
      worker.terminate()
    }
  }, [variant, frameRate, scale, reduced])

  return <svg className="contour-field" viewBox="0 0 64 40" preserveAspectRatio="none" aria-hidden="true">
    <g ref={paths} fill="none" stroke="currentColor" strokeWidth="0.32">{Array.from({ length: 7 }, (_, i) => <path key={i} />)}</g>
  </svg>
}

type FieldPan = { panX: MotionValue<number>; panY: MotionValue<number> }

export function NoiseField({ kind, pan }: { kind: 'canine' | 'sea'; pan?: FieldPan }) {
  return kind === 'sea' ? <SeaField pan={pan} /> : <CanineField />
}

function SeaField({ pan }: { pan?: FieldPan }) {
  const host = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    const canvas = document.createElement('canvas')
    canvas.className = 'noise-field'
    host.current!.append(canvas)
    const scene = canvas.closest<HTMLElement>('.scene')!
    const renderer = createSeaRenderer(canvas, createNoise3D(randomSource(443)))
    let ready = false
    let frame = 0
    let pointer = { x: -10000, y: -10000 }
    function paint(time: number) {
      if (ready) renderer.draw(time, pointer, { x: pan?.panX.get() ?? 0, y: pan?.panY.get() ?? 0 })
    }
    const observer = new ResizeObserver(([entry]) => {
      renderer.resize(entry.contentRect.width, entry.contentRect.height, Math.max(0.75, scene.clientWidth / 1188))
      ready = true
      if (reduced) paint(0)
    })
    observer.observe(host.current!)

    function move(event: PointerEvent) {
      const bounds = canvas.getBoundingClientRect()
      pointer = { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
      if (reduced) paint(0)
    }
    function leave() {
      pointer = { x: -10000, y: -10000 }
      if (reduced) paint(0)
    }
    function draw(now: number) {
      paint(now * NOISE_SPEED)
      frame = requestAnimationFrame(draw)
    }
    scene.addEventListener('pointermove', move)
    scene.addEventListener('pointerleave', leave)
    const unsubscribeX = pan?.panX.on('change', () => { if (reduced) paint(0) })
    const unsubscribeY = pan?.panY.on('change', () => { if (reduced) paint(0) })
    if (!reduced) frame = requestAnimationFrame(draw)
    return () => {
      unsubscribeX?.()
      unsubscribeY?.()
      observer.disconnect()
      cancelAnimationFrame(frame)
      scene.removeEventListener('pointermove', move)
      scene.removeEventListener('pointerleave', leave)
      renderer.dispose()
      canvas.remove()
    }
  }, [reduced, pan?.panX, pan?.panY])

  return <div ref={host} className="sea-field" aria-hidden="true" />
}

function CanineField() {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    const canvas = ref.current!
    const context = canvas.getContext('2d')!
    const scene = canvas.closest<HTMLElement>('.scene')!
    const noise = createNoise3D(randomSource(443))
    const frameInterval = 1000 / 24
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
      render = createHalftone(image, noise, unit)
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
        render(reduced ? 0 : now * NOISE_SPEED, pointer)
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
  }, [reduced])

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
