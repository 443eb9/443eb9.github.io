import { useLayoutEffect, useRef } from 'react'
import { useReducedMotion } from 'motion/react'
import { nearbyCharacters, roleFrame, ROLE_TEXTS, SCAN_PHASE, SCAN_TIMING, scanLineDuration, settledGlyphs, sweepProgress } from './scan'

export function ScanText() {
  const ref = useRef<HTMLSpanElement>(null)
  const reduced = useReducedMotion()

  useLayoutEffect(() => {
    const root = ref.current!
    let frame = 0
    let timer = 0
    let disposed = false
    let started = 0
    let currentRole = ''
    let fontSize = 0
    let width = 0
    let sweepDuration = SCAN_TIMING.sweep as number
    let inkTop = 0
    let inkHeight = 0
    let lastPhase = ''
    let cells: { box: HTMLSpanElement; ink: HTMLSpanElement; text: string; left: number; width: number; symbols: string[]; nextChange: number; visibleAt: number }[] = []
    let particles: { element: HTMLSpanElement; at: number; blackAt: number }[] = []
    const blue = document.createElement('span')
    const line = document.createElement('span')
    const squares = document.createElement('span')
    blue.className = 'scan-blue'
    line.className = 'scan-line'
    squares.className = 'scan-squares'
    root.replaceChildren(blue, line, squares)
    const context = document.createElement('canvas').getContext('2d')!

    function measure(text: string) {
      currentRole = text
      root.setAttribute('aria-label', text)
      const style = getComputedStyle(root)
      fontSize = parseFloat(style.fontSize)
      context.font = `${style.fontWeight} ${style.fontSize} 'Ark Pixel'`
      const full = context.measureText(text)
      inkHeight = full.actualBoundingBoxAscent + full.actualBoundingBoxDescent + 2
      const baseline = (fontSize * 1.2 - full.fontBoundingBoxAscent - full.fontBoundingBoxDescent) / 2 + full.fontBoundingBoxAscent
      inkTop = baseline - full.actualBoundingBoxAscent - 1
      width = 0
      cells = Array.from(text, character => {
        const box = document.createElement('span')
        const ink = document.createElement('span')
        const cellWidth = context.measureText(character).width
        box.className = 'scan-glyph'
        ink.className = 'scan-ink'
        ink.textContent = character
        ink.dataset.target = character
        box.style.width = `${cellWidth}px`
        box.append(ink)
        const cell = { box, ink, text: character, left: width, width: cellWidth, nextChange: 0, visibleAt: Infinity, symbols: nearbyCharacters(character).filter(candidate => context.measureText(candidate).width <= cellWidth + 0.01) }
        width += cellWidth
        return cell
      })
      sweepDuration = scanLineDuration(width)
      line.replaceChildren(...cells.map(cell => cell.box))
      Object.assign(blue.style, { top: `${inkTop}px`, height: `${inkHeight}px`, width: `${width}px` })
    }

    function createSquares() {
      squares.replaceChildren()
      const count = Math.ceil(width / (fontSize * 0.85))
      particles = Array.from({ length: count }, (_, i) => {
        const progress = (i + 0.2 + Math.random() * 0.6) / count
        const size = fontSize * (0.18 + Math.random() * 0.28)
        const element = document.createElement('span')
        const x = Math.max(0, Math.min(width, width * sweepProgress(progress, 1) + (Math.random() - 0.5) * fontSize * 0.3))
        const y = (Math.random() < 0.5 ? inkTop : inkTop + inkHeight) + (Math.random() - 0.5) * fontSize * 0.6
        element.className = 'scan-square'
        Object.assign(element.style, { left: `${x - size / 2}px`, top: `${y - size / 2}px`, width: `${size}px`, height: `${size}px`, visibility: 'hidden' })
        squares.append(element)
        const at = SCAN_TIMING.textDelay + sweepDuration * progress
        return { element, at, blackAt: at + 50 + Math.random() * 60 }
      })
    }

    function draw(now: number) {
      if (disposed) return
      const state = roleFrame(now - started)
      if (state.role !== currentRole) measure(state.role)
      if (state.phase !== lastPhase) {
        lastPhase = state.phase
        root.dataset.phase = state.phase
        for (const cell of cells) { cell.visibleAt = Infinity; cell.nextChange = 0 }
        if (state.phase === SCAN_PHASE.entry) createSquares()
        else { squares.replaceChildren(); particles = [] }
      }
      if (state.phase === SCAN_PHASE.blank || state.phase === SCAN_PHASE.hold) {
        const visible = state.phase === SCAN_PHASE.hold
        line.style.visibility = visible ? 'visible' : 'hidden'
        blue.style.visibility = 'hidden'
        line.style.clipPath = 'none'
        for (const cell of cells) {
          cell.ink.textContent = cell.text
          cell.box.style.clipPath = 'none'
          cell.ink.style.cssText = ''
        }
        timer = window.setTimeout(() => { frame = requestAnimationFrame(draw) }, state.remaining)
        return
      }

      const clearing = state.phase === SCAN_PHASE.clear
      const delay = clearing ? 0 : SCAN_TIMING.textDelay
      const duration = clearing ? 720 : sweepDuration
      const front = sweepProgress(state.elapsed - delay, duration)
      const back = sweepProgress(state.elapsed - delay - duration * SCAN_TIMING.whiteDelayRatio, duration)
      const edge = front * width
      const rear = back * width
      blue.style.visibility = 'visible'
      blue.style.transform = `scaleX(${front})`
      blue.style.clipPath = `inset(0 0 0 ${front ? back / front * 100 : 100}%)`
      line.style.visibility = 'visible'
      line.style.clipPath = clearing ? `inset(-20px 0 -20px ${rear}px)` : 'none'

      const settled = settledGlyphs(cells.length, state.elapsed - delay)
      for (const [index, cell] of cells.entries()) {
        if (edge > cell.left && cell.visibleAt === Infinity) cell.visibleAt = state.elapsed
        const age = state.elapsed - cell.visibleAt
        const expansion = sweepProgress(age, SCAN_TIMING.diffusion)
        const clarity = sweepProgress(age, duration * SCAN_TIMING.whiteDelayRatio)
        const active = edge > cell.left && rear < cell.left + cell.width
        const revealed = clearing ? !active : index < settled
        cell.box.style.clipPath = clearing ? 'none' : `inset(-12px ${Math.max(0, cell.left + cell.width - edge)}px -12px 0)`
        cell.ink.style.setProperty('--white-edge', `${Math.max(0, rear - cell.left)}px`)
        cell.ink.style.setProperty('--blue-edge', `${Math.max(0, edge - cell.left)}px`)
        cell.ink.style.filter = `blur(${(clearing ? clarity : 1 - clarity) * 2.4}px)`
        const diffusion = clearing ? (active ? expansion : 0) : 1 - expansion
        cell.ink.style.transform = `scale(${1 + diffusion * 0.16}, ${1 + diffusion * 0.08})`
        if (revealed || cell.symbols.length === 0) cell.ink.textContent = cell.text
        else if (now >= cell.nextChange) {
          cell.ink.textContent = cell.symbols[Math.floor(Math.random() * cell.symbols.length)]
          cell.nextChange = now + 35 + Math.random() * 80
        }
      }
      for (const particle of particles) {
        if (state.elapsed < particle.at || !particle.element.isConnected) continue
        if (state.elapsed >= particle.blackAt + SCAN_TIMING.squareBlack) { particle.element.remove(); continue }
        particle.element.style.visibility = 'visible'
        particle.element.dataset.color = state.elapsed >= particle.blackAt ? 'black' : 'blue'
        particle.element.style.transform = `scale(${0.6 + sweepProgress(state.elapsed - particle.at, 40) * 0.4})`
      }
      frame = requestAnimationFrame(draw)
    }

    const observer = new ResizeObserver(() => {
      if (currentRole) {
        measure(currentRole)
        if (lastPhase === SCAN_PHASE.entry) createSquares()
      }
    })
    observer.observe(root)
    void document.fonts.ready.then(() => {
      if (disposed) return
      if (reduced) {
        root.dataset.phase = SCAN_PHASE.hold
        line.textContent = ROLE_TEXTS[0]
        return
      }
      started = performance.now()
      draw(started)
    })
    return () => {
      disposed = true
      observer.disconnect()
      cancelAnimationFrame(frame)
      clearTimeout(timer)
      root.replaceChildren()
    }
  }, [reduced])

  return <span ref={ref} className="scan-text" aria-label={ROLE_TEXTS[0]} />
}
