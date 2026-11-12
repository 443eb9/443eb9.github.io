import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { GRAY_BLOCK_TIMING, grayBlockFrames, stripeShift } from './decoration'

function GrayBlock({ index }: { index: number }) {
  const ref = useRef<HTMLElement>(null)
  const reduced = useReducedMotion()
  useEffect(() => {
    const element = ref.current!
    let animation: Animation
    let disposed = false
    let first = true
    function place() {
      if (disposed) return
      const initialRegions = [[9.428, 27.628, 9.764], [7.281, 68.393, 20.37], [72.938, -2.027, 6.481], [69.402, 28.228, 5.219], [12.963, 57.132, 5.135], [-2.862, 36.862, 5.261], [1.305, 94.595, 3.409]]
      const [left, top, width] = first && index < initialRegions.length ? initialRegions[index] : [Math.random() * 96, Math.random() * 96, 2 + Math.random() * 10]
      Object.assign(element.style, { left: `${left}%`, top: `${top}%`, width: `${width}%` })
      first = false
      if (reduced) { element.style.opacity = '1'; return }
      const duration = GRAY_BLOCK_TIMING.minimum + Math.random() * (GRAY_BLOCK_TIMING.maximum - GRAY_BLOCK_TIMING.minimum)
      const flashes = Math.random() < 0.5 ? 2 : 3
      animation = element.animate(grayBlockFrames(duration, flashes), { duration, easing: 'linear', fill: 'both' })
      animation.onfinish = place
    }
    place()
    return () => { disposed = true; animation?.cancel() }
  }, [index, reduced])
  return <i ref={ref} />
}

export function GrayBlocks() {
  return <div className="gray-blocks" aria-hidden="true">{Array.from({ length: 7 }, (_, i) => <GrayBlock key={i} index={i} />)}</div>
}

export function StripeSquare() {
  const [pointer, setPointer] = useState({ x: -1000, y: -1000 })
  const paths = Array.from({ length: 15 }, (_, i) => {
    const intercept = i * 24 - 96
    const shift = stripeShift(intercept, pointer)
    return <motion.path key={i} d={`M-128,${intercept + 128}L256,${intercept - 256}`} animate={{ x: shift, y: shift }} transition={{ type: 'spring', stiffness: 260, damping: 28, mass: 0.6 }} />
  })
  return <div className="stripe-square" onPointerMove={event => {
    const box = event.currentTarget.getBoundingClientRect()
    setPointer({ x: (event.clientX - box.left) / box.width * 128, y: (event.clientY - box.top) / box.height * 128 })
  }} onPointerLeave={() => setPointer({ x: -1000, y: -1000 })} aria-hidden="true">
    {['top', 'right', 'bottom', 'left'].map(edge => <span key={edge} className={`stripe-edge stripe-edge-${edge}`} />)}
    <svg viewBox="0 0 128 128"><g fill="none" stroke="currentColor" strokeWidth="3">{paths}</g></svg>
    <span className="stripe-corner stripe-corner-blue" />
    <span className="stripe-corner stripe-corner-gray" />
  </div>
}
