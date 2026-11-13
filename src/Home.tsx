import { useState } from 'react'
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react'
import { Contours, Corners, NoiseField } from './Fields'
import { ScanText } from './ScanText'
import { GrayBlocks, StripeSquare } from './Decorations'

export function Home() {
  const [notice, setNotice] = useState('')
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

  return <main className="home scene relative isolate overflow-hidden"
    onPointerMove={event => {
      if (reduced || event.pointerType === 'touch') return
      const bounds = event.currentTarget.getBoundingClientRect()
      x.set((event.clientX - bounds.left) / bounds.width - 0.5)
      y.set((event.clientY - bounds.top) / bounds.height - 0.5)
    }} onPointerLeave={() => { x.set(0); y.set(0) }}>
    <motion.div className="scene-layer layer-one" style={{ x: farX, y: farY }} aria-hidden="true">
      <div className="canine"><NoiseField kind="canine" /></div>
    </motion.div>
    <motion.div className="scene-layer layer-two" style={{ x: midX, y: midY }}><div className="background-grid" /><div className="canine canine-outline" aria-hidden="true" /></motion.div>
    <motion.div className="scene-layer layer-three" style={{ x: midX, y: midY }}><GrayBlocks /></motion.div>
    <motion.div className="scene-layer layer-four" style={{ x: nearX, y: nearY }}>
      <div className="top-rail" aria-hidden="true"><i className="rail-start" /><i className="rail-end" /></div>
      <svg className="left-rail" viewBox="0 0 30 124" aria-hidden="true"><path fill="var(--gray)" d="M2.5 30h19.5v41H7v53H2.5Z" /><path fill="var(--blue)" d="M0 0h22v31H3v73H0Z" /></svg>
      <header className="identity flex items-start">
        <img src="/images/avatar-original.png" className="avatar" width="164" height="164" alt="头像" />
        <div className="identity-copy"><p className="intro">I am</p><h1>44eb9#C</h1><div className="role-area"><ScanText /></div>
          <svg className="identity-rules" viewBox="0 0 181 44" aria-hidden="true"><g fill="currentColor"><path d="M0 5h13v13H0ZM26 5h13v13H26ZM13 18h13v13H13ZM0 31h13v13H0ZM26 31h13v13H26Z" /><path d="M0 0h181v2.5H0ZM42 6h139v2.5H42ZM42 12.5h139v3H42ZM42 18.5h139V21H42ZM42 25h139v3H42Z" /></g></svg>
        </div>
      </header>
      <div className="valley terrain-panel"><span className="panel-label">Crepuscular Archipelago</span><Contours variant={2} frameRate={60} /><Corners seed={2} /><span className="panel-coordinate">VALLEY #015</span></div>
      <div className="height-map terrain-panel"><span className="panel-label">// HEIGHT MAP</span><Contours variant={5} frameRate={60} /><Corners seed={5} /></div>
      <div className="tile-stack" aria-hidden="true">{[0, 1, 2, 3, 4, 5].map(i => <span key={i} />)}</div>
      <StripeSquare />
    </motion.div>
    <motion.div className="scene-layer layer-five" style={{ x: topX, y: topY }}>
      <nav className="home-nav" aria-label="主导航">
        {[{ label: '日志', href: '/log' }, { label: '元数据', href: '/metadata' }, { label: '邻域', href: '/neighbourhood' }, { label: '开往', href: null }].map(({ label, href }, i) => href
          ? <a className="frame-button" href={href} key={label}><span className="button-label">{label}</span><span className="button-cover" aria-hidden="true">{label}</span><Corners seed={i} /></a>
          : <button className="frame-button" type="button" key={label} onClick={() => setNotice(`${label} · 建设中`)}><span className="button-label">{label}</span><span className="button-cover" aria-hidden="true">{label}</span><Corners seed={i} /></button>)}
      </nav>
    </motion.div>
    <p className="notice" role="status">{notice}</p>
  </main>
}
