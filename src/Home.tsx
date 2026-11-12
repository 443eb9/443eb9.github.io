import { useEffect, useRef, useState } from 'react'
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react'
import { Contours, Corners, NoiseField } from './Fields'

function RoleText() {
  const [tick, setTick] = useState(0)
  const reduced = useReducedMotion()
  useEffect(() => {
    if (reduced) return
    const start = performance.now()
    const timer = window.setInterval(() => setTick(performance.now() - start), 65)
    return () => clearInterval(timer)
  }, [reduced])

  const roles = ['Anime Illustrator', 'Software Engineer']
  const role = roles[Math.floor(tick / 11000) % roles.length]
  const progress = tick % 11000
  const reveal = Math.max(0, Math.min(1, (progress - 650) / 2300))
  const erase = Math.max(0, Math.min(1, (progress - 7800) / 1700))
  const count = reduced ? role.length : Math.floor(role.length * reveal)
  const scanning = progress > 650 && progress < 2950
  const clearing = progress > 7800 && progress < 9500
  const glyphs = '▞▚╳#░01アニメ'

  return <div className="role-area">
    <span className="sr-only">Anime Illustrator / Software Engineer</span>
    <div className={`role-text ${clearing ? 'clearing' : ''}`} aria-hidden="true">
      {Array.from(role).map((character, i) => <span key={i} style={{ opacity: i < count && i / role.length >= erase ? 1 : 0, color: scanning && i >= count - 3 ? 'var(--paper)' : undefined }}>
        {scanning && i >= count - 2 ? glyphs[(i + Math.floor(tick / 65)) % glyphs.length] : character === ' ' ? '\u00a0' : character}
      </span>)}
    </div>
    {!reduced && <motion.span className="role-scan" aria-hidden="true" style={{ left: `${clearing ? erase * 105 : reveal * 105}%`, opacity: scanning || clearing ? 1 : 0 }} />}
    {!reduced && <span className="role-trail" aria-hidden="true" style={{ left: `${reveal * 100 - 8}%`, opacity: scanning ? 0.7 : 0 }}>░ ▪ 01</span>}
  </div>
}

function GrayBlocks() {
  const reduced = useReducedMotion()
  return <div className="gray-blocks" aria-hidden="true">
    {Array.from({ length: 16 }, (_, i) => <motion.i key={i}
      style={{ left: `${(i * 37 + 9) % 95}%`, top: `${(i * 23 + 4) % 94}%`, width: `${3 + (i % 4) * 3}%`, aspectRatio: i % 3 ? '1' : '2' }}
      animate={reduced ? { opacity: 0.25 } : { opacity: [0, 0.65, 0.15, 0.7, 0.65, 0.65, 0.1, 0.65, 0] }}
      transition={reduced ? { duration: 0 } : { duration: 5 + (i % 6) * 2, repeat: Infinity, delay: i * 0.63, times: [0, 0.03, 0.05, 0.08, 0.12, 0.84, 0.88, 0.93, 1] }} />)}
  </div>
}

export function Home() {
  const [notice, setNotice] = useState('')
  const frame = useRef<HTMLElement>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const reduced = useReducedMotion()
  const smoothX = useSpring(x, { stiffness: 90, damping: 25 })
  const smoothY = useSpring(y, { stiffness: 90, damping: 25 })
  const farX = useTransform(smoothX, value => value * -30)
  const farY = useTransform(smoothY, value => value * -20)
  const midX = useTransform(smoothX, value => value * -22)
  const midY = useTransform(smoothY, value => value * -15)
  const nearX = useTransform(smoothX, value => value * 7)
  const nearY = useTransform(smoothY, value => value * 5)
  const topX = useTransform(smoothX, value => value * 10)
  const topY = useTransform(smoothY, value => value * 7)

  return <main className="home scene relative isolate overflow-hidden" ref={frame}
    onPointerMove={event => {
      if (reduced) return
      const bounds = event.currentTarget.getBoundingClientRect()
      x.set((event.clientX - bounds.left) / bounds.width - 0.5)
      y.set((event.clientY - bounds.top) / bounds.height - 0.5)
    }} onPointerLeave={() => { x.set(0); y.set(0) }}>
    <motion.div className="scene-layer layer-one" style={{ x: farX, y: farY }} aria-hidden="true">
      <div className="canine"><NoiseField dense /></div>
    </motion.div>
    <motion.div className="scene-layer layer-two" style={{ x: midX, y: midY }}><NoiseField /></motion.div>
    <motion.div className="scene-layer layer-three" style={{ x: midX, y: midY }}><GrayBlocks /></motion.div>
    <motion.div className="scene-layer layer-four" style={{ x: nearX, y: nearY }}>
      <div className="top-rail" aria-hidden="true"><Corners seed={8} /></div>
      <div className="vertical-rail" aria-hidden="true" />
      <header className="identity flex items-start">
        <img src="/images/avatar-original.webp" className="avatar" width="164" height="164" alt="443eb9#C 的兽耳角色头像" />
        <div className="identity-copy"><p className="intro">I am</p><h1>44eb9#C</h1><RoleText /><div className="identity-rules" aria-hidden="true" /></div>
      </header>
      <div className="valley terrain-panel"><span className="panel-label">Crepuscular Archipelago</span><Contours variant={2} /><Corners seed={2} /><span className="panel-coordinate">VALLEY #015</span></div>
      <div className="height-map terrain-panel"><span className="panel-label">// HEIGHT MAP</span><Contours variant={5} /><Corners seed={5} /></div>
      <div className="tile-stack" aria-hidden="true">{[0, 1, 2, 3, 4, 5].map(i => <span key={i} />)}</div>
      <div className="stripe-square" aria-hidden="true"><Corners seed={3} /></div>
    </motion.div>
    <motion.div className="scene-layer layer-five" style={{ x: topX, y: topY }}>
      <nav className="home-nav flex flex-col" aria-label="主导航">
        {['日志', '元数据', '邻域', '开往'].map((label, i) => i === 0
          ? <a className="frame-button" href="/log" key={label}><span className="button-label">{label}</span><span className="button-cover" aria-hidden="true">{label}</span><Corners seed={i} /></a>
          : <button className="frame-button" type="button" key={label} onClick={() => setNotice(`${label} · 建设中`)}><span className="button-label">{label}</span><span className="button-cover" aria-hidden="true">{label}</span><Corners seed={i} /></button>)}
      </nav>
    </motion.div>
    <p className="notice" role="status">{notice}</p>
  </main>
}
