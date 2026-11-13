import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion, type MotionValue } from 'motion/react'
import { NoiseField } from './Fields'

const FADE_DURATION = 0.35

type Pan = { panX: MotionValue<number>; panY: MotionValue<number> }

function ImageBackground({ src, pan }: { src: string; pan: Pan }) {
  const [ready, setReady] = useState(false)
  const reduced = useReducedMotion()
  const duration = reduced ? 0 : FADE_DURATION
  return <motion.div className="map-background-layer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration }}>
    <AnimatePresence initial={false}>{!ready && <motion.div className="map-background-layer" exit={{ opacity: 0 }} transition={{ duration }}><NoiseField kind="sea" pan={pan} /></motion.div>}</AnimatePresence>
    <motion.img className="friend-scene-background" src={src} alt="" onLoad={() => setReady(true)} initial={{ opacity: 0 }} animate={{ opacity: ready ? 1 : 0 }} transition={{ duration }} />
  </motion.div>
}

export function MapBackground({ image, pan }: { image?: string; pan: Pan }) {
  const reduced = useReducedMotion()
  return <div className="log-background" aria-hidden="true"><AnimatePresence initial={false}>
    {image ? <ImageBackground key={image} src={image} pan={pan} /> : <motion.div key="sea" className="map-background-layer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : FADE_DURATION }}><NoiseField kind="sea" pan={pan} /></motion.div>}
  </AnimatePresence></div>
}
