import { useEffect, useId, useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import islands from './generated/islands.json'
import { Contours, Corners, NoiseField } from './Fields'
import { hash, islandPosition, islandShape, PAGE_SIZE } from './terrain'

type Island = { id: string; title: string; desc: string; tags: string[]; date: string | null }

function IslandTile({ island, index, day, selected, onSelect }: { island: Island; index: number; day: string; selected: boolean; onSelect: () => void }) {
  const id = useId().replaceAll(':', '')
  const position = islandPosition(index, day, island.id)
  const cells = useMemo(() => islandShape(hash(`${day}:${island.id}`)), [day, island.id])
  const shape = cells.map(([x, y]) => `M${x * 40},${y * 40}h40v40h-40Z`).join('')
  return <motion.div className={`island ${selected ? 'selected' : ''} island-${index}`} style={{ left: `clamp(85px, ${position.x}%, calc(100% - 85px))`, top: `${position.y}%` }}
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3, delay: index * 0.035 }}>
    <button className="island-hit" type="button" onClick={onSelect} aria-expanded={selected} aria-controls="island-card" aria-label={`展开 ${island.title}`}>
      <svg className="island-geometry" viewBox="0 0 200 200" aria-hidden="true">
        <defs><clipPath id={id}><path d={shape} /></clipPath></defs>
        <path d={shape} className="island-fill" />
        <foreignObject x="0" y="0" width="200" height="200" clipPath={`url(#${id})`}><Contours variant={hash(island.id) % 100} /></foreignObject>
        <path d={shape} fill="none" stroke="var(--blue)" strokeWidth="0.8" />
        {selected && <g clipPath={`url(#${id})`}><path d="M-30,-30L230,230" stroke="var(--paper)" strokeWidth="24" /><rect x="94" y="94" width="12" height="12" fill="var(--paper)" /></g>}
      </svg>
      <span className="island-title frame-label"><span>{island.title}</span><Corners seed={index} /></span>
    </button>
  </motion.div>
}

export function Log() {
  const reduced = useReducedMotion()
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [width, setWidth] = useState(window.innerWidth)
  const [day, setDay] = useState(() => new Date().toISOString().slice(0, 10))
  const count = Math.ceil(islands.length / PAGE_SIZE)
  const visible = islands.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const active = visible.find(island => island.id === selected)
  const activeIndex = visible.findIndex(island => island.id === selected)
  const position = active ? islandPosition(activeIndex, day, active.id) : null
  const narrow = width <= 800
  const pageStart = narrow ? Math.max(1, Math.min(page - 1, count - 2)) : 1
  const pageNumbers = Array.from({ length: narrow ? Math.min(3, count) : count }, (_, i) => pageStart + i)
  const anchorX = position ? Math.max(85000 / width, Math.min(position.x * 10, 1000 - 85000 / width)) : 0

  useEffect(() => {
    document.title = '日志 · Crepuscular Archipelago'
    const timer = window.setInterval(() => setDay(new Date().toISOString().slice(0, 10)), 60000)
    const resize = () => setWidth(window.innerWidth)
    window.addEventListener('resize', resize)
    return () => { clearInterval(timer); window.removeEventListener('resize', resize) }
  }, [])
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setSelected(null); setMenuOpen(false) }
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [])

  function turn(next: number) {
    setPage(Math.max(1, Math.min(count, next)))
    setSelected(null)
  }

  return <main className="log scene relative isolate overflow-hidden" onPointerMove={event => {
    if (reduced || event.pointerType === 'touch') return
    const bounds = event.currentTarget.getBoundingClientRect()
    event.currentTarget.style.setProperty('--pointer-x', `${((event.clientX - bounds.left) / bounds.width - 0.5) * -20}px`)
    event.currentTarget.style.setProperty('--pointer-y', `${((event.clientY - bounds.top) / bounds.height - 0.5) * -14}px`)
  }} onPointerLeave={event => {
    event.currentTarget.style.setProperty('--pointer-x', '0px')
    event.currentTarget.style.setProperty('--pointer-y', '0px')
  }}>
    <div className="log-background"><NoiseField dense /></div>
    <div className="log-mark" aria-hidden="true">{Array.from({ length: 6 }, (_, i) => <i key={i} />)}</div>
    <header className="log-header flex items-start justify-between">
      <div className="directory">
        <button className="directory-toggle" type="button" aria-expanded={menuOpen} aria-controls="directory-list" onClick={() => setMenuOpen(value => !value)}><span className="hamburger" aria-hidden="true">☰</span>目录</button>
        <AnimatePresence>{menuOpen && <motion.nav className="directory-list" id="directory-list" aria-label="岛屿目录" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
          {islands.map((island, i) => <button key={island.id} type="button" onClick={() => { setPage(Math.floor(i / PAGE_SIZE) + 1); setSelected(island.id); setMenuOpen(false) }}><span>{String(i + 1).padStart(2, '0')}</span>{island.title}</button>)}
        </motion.nav>}</AnimatePresence>
      </div>
      <a href="/" className="site-link" aria-label="返回首页"><span>Crepuscular<br />Archipelago</span><span className="barcode" aria-hidden="true" /></a>
    </header>
    <div className="island-map" aria-label={`第 ${page} 页，共 ${visible.length} 个岛屿`}>
      <AnimatePresence mode="wait"><motion.div key={`${day}-${page}`} className="map-items" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
        {visible.map((island, i) => <IslandTile key={island.id} island={island} index={i} day={day} selected={selected === island.id} onSelect={() => setSelected(value => value === island.id ? null : island.id)} />)}
      </motion.div></AnimatePresence>
      <AnimatePresence>{active && position && <motion.div className="selection" key={active.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <svg className="connector" viewBox="0 0 1000 560" preserveAspectRatio="none" aria-hidden="true">
          <motion.path d={`M${anchorX},${position.y * 5.6}L${narrow ? 100 : 450},220`} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4 }} />
          <rect x={anchorX - 5} y={position.y * 5.6 - 5} width="10" height="10" />
        </svg>
        <motion.article id="island-card" className="island-card" aria-live="polite" initial={{ clipPath: 'inset(0 100% 0 0)' }} animate={{ clipPath: 'inset(-20px -20px -30px -20px)' }} transition={{ duration: 0.3 }} aria-label={active.title}>
          <span className="card-caption">// Island</span>
          <div className="card-heading flex items-start justify-between"><h1>{active.title}</h1><button type="button" className="close-card" aria-label="关闭岛屿卡片" onClick={() => setSelected(null)}>×</button></div>
          <div className="card-rule"><span>#{String((page - 1) * PAGE_SIZE + activeIndex + 1).padStart(2, '0')}</span></div>
          {active.desc && <p className="card-description">{active.desc}</p>}
          <ul className="tags flex flex-wrap justify-end gap-2" aria-label="标签">{active.tags.map((tag, i) => <li className="frame-button tag" key={tag}><span className="button-label">{tag}</span><span className="button-cover" aria-hidden="true">{tag}</span><Corners seed={i} /></li>)}</ul>
          <Corners seed={3} />
          <span className="card-date">{active.date ? <time dateTime={active.date}>{new Intl.DateTimeFormat('sv-SE', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Shanghai' }).format(new Date(active.date))}</time> : 'long term project'}</span>
        </motion.article>
      </motion.div>}</AnimatePresence>
    </div>
    <footer className="log-footer flex items-end justify-between"><span className="page-coordinate">ISLANDS {String((page - 1) * PAGE_SIZE + 1).padStart(2, '0')}—{String(Math.min(page * PAGE_SIZE, islands.length)).padStart(2, '0')} / {islands.length}</span>
      <nav className="pagination flex items-center" aria-label="日志分页">
        <button className="page-button" type="button" aria-label="上一页" disabled={page === 1} onClick={() => turn(page - 1)}>‹</button>
        {pageNumbers.map(number => <button className="page-button" type="button" key={number} aria-label={`第 ${number} 页`} aria-current={page === number ? 'page' : undefined} onClick={() => turn(number)}>{number}</button>)}
        <button className="page-button" type="button" aria-label="下一页" disabled={page === count} onClick={() => turn(page + 1)}>›</button>
      </nav>
    </footer>
  </main>
}
