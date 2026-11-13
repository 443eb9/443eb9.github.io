import { type CSSProperties, type RefObject, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { animate, AnimatePresence, motion, type MotionValue, useDragControls, useMotionValue, useMotionValueEvent, useReducedMotion, useTransform, useIsPresent } from 'motion/react'
import { Contours, Corners } from './Fields'
import { MapBackground } from './MapBackground'
import { hash, PAGE_SIZE } from './terrain'
import { cardLayout, connectorBand, islandLayouts, ISLAND_GRID_WIDTH, ISLAND_OUTLINE, logGrid } from './log-layout'
import { ISLAND_DURATION, labelBlink } from './log-animation'
import { islandPath } from './island-content'
import { VideoIslands } from './VideoIslands'
import { IslandBody } from './Island'

const CARD_TIMING = { connector: 0.4, reveal: 0.32 } as const
const SWEEP_EASE = [0.22, 1, 0.36, 1] as const

export type MapItem = { id: string; title: string; desc: string; tags: string[]; date: string | null; ty?: string; ref?: string | null; body?: string; encrypted?: boolean; friend?: { avatar: string; link: string; background?: string } }
type IslandLayout = ReturnType<typeof islandLayouts>[number]
type TerrainCell = { x: number; y: number; islandIndex: number }
type SelectionLayout = Pick<IslandLayout, 'center' | 'bounds'>

function TerrainCells({ cells, size, borders = false, selectedIndex = -1, fade = false }: { cells: TerrainCell[]; size: number; borders?: boolean; selectedIndex?: number; fade?: boolean }) {
  const reduced = useReducedMotion()
  const inset = borders ? 1 : 0
  const width = size - inset * 2
  return <AnimatePresence initial={false}>{cells.map(cell => {
    const x = cell.x + inset
    return <motion.rect key={`${cell.x}:${cell.y}:${size}`} className={borders ? 'land-cell' : 'terrain-cell'} data-cell={`${cell.x}:${cell.y}:${size}`} x={x} y={cell.y + inset} height={width}
      fill={borders ? 'none' : undefined} stroke={borders && cell.islandIndex !== selectedIndex ? 'var(--blue)' : 'none'} strokeWidth={borders ? 0.7 : undefined}
      initial={reduced ? false : fade ? { attrX: x, width, opacity: 0 } : { attrX: x, width: 0 }} animate={{ attrX: x, width, opacity: 1 }} exit={fade ? { opacity: 0 } : { attrX: x + width, width: 0 }} transition={{ duration: reduced ? 0 : ISLAND_DURATION, ease: SWEEP_EASE }} />
  })}</AnimatePresence>
}

function IslandTile({ island, index, layout, unit, selected, onSelect }: { island: MapItem; index: number; layout: IslandLayout; unit: number; selected: boolean; onSelect: () => void }) {
  const present = useIsPresent()
  const reduced = useReducedMotion()
  const [blink] = useState(() => ({ enter: labelBlink(true), exit: labelBlink(false) }))
  const halfDuration = reduced ? 0 : ISLAND_DURATION / 2
  const fade = Boolean(island.friend)
  const Hit = island.ty === 'achievement' ? 'span' : island.ty === 'external' ? 'a' : 'button'
  const expandable = Hit === 'button'
  return <div data-island-id={island.id} className={`island ${selected ? 'selected' : ''}`} inert={!present} aria-hidden={present ? undefined : true} style={{ left: layout.center.x * unit, top: layout.center.y * unit }}>
    <Hit className="island-hit" {...(expandable ? { type: 'button' as const, disabled: !present, onClick: onSelect, 'aria-expanded': selected, 'aria-controls': 'island-card', 'aria-label': `展开 ${island.title}` } : Hit === 'a' ? { href: island.ref ?? undefined, target: '_blank', rel: 'noopener noreferrer', 'aria-label': `访问 ${island.title}` } : {})}>
      <svg className="island-hit-shape" viewBox={`${layout.left} ${layout.top} ${(layout.center.x - layout.left) * 2} ${(layout.center.y - layout.top) * 2}`} aria-hidden="true"><path d={layout.shape} fill="transparent" pointerEvents="fill" /></svg>
      <motion.span className="island-title frame-label" initial={reduced ? false : { opacity: 0 }}
        animate={{ opacity: reduced || fade ? 1 : blink.enter.opacity, transition: fade ? { duration: halfDuration } : { duration: halfDuration, delay: halfDuration, times: blink.enter.times, ease: 'linear' } }}
        exit={{ opacity: reduced || fade ? 0 : blink.exit.opacity, transition: fade ? { duration: halfDuration } : { duration: halfDuration, delay: 0, times: blink.exit.times, ease: 'linear' } }}><span>{island.title}</span><Corners seed={index} /></motion.span>
    </Hit>
  </div>
}

function IslandSelection({ island, layout: mapLayout, world, unit, panX, panY, index, onClose }: { island: MapItem; layout: SelectionLayout; world: { width: number; height: number }; unit: number; panX: MotionValue<number>; panY: MotionValue<number>; index: number; onClose: () => void }) {
  const reduced = useReducedMotion()
  const [pan, setPan] = useState(() => ({ x: panX.get(), y: panY.get() }))
  useMotionValueEvent(panX, 'change', x => setPan(previous => ({ ...previous, x })))
  useMotionValueEvent(panY, 'change', y => setPan(previous => ({ ...previous, y })))
  const layout = {
    center: { x: mapLayout.center.x + pan.x / unit, y: mapLayout.center.y + pan.y / unit },
    bounds: { left: mapLayout.bounds.left + pan.x / unit, top: mapLayout.bounds.top + pan.y / unit, right: mapLayout.bounds.right + pan.x / unit, bottom: mapLayout.bounds.bottom + pan.y / unit },
  }
  const cardRef = useRef<HTMLElement>(null)
  const filterId = `${useId().replaceAll(':', '')}-connector-colors`
  const [cardSize, setCardSize] = useState<{ width: number; height: number } | null>(null)
  const direct = Boolean(island.friend)
  const connection = cardSize && !direct ? cardLayout(layout, cardSize, world, island.ty === 'note' ? 0 : 90) : null
  const placement = cardSize && direct ? {
    left: Math.max(16, Math.min(layout.center.x - cardSize.width / 2, world.width - cardSize.width - 16)),
    top: Math.max(90, Math.min(layout.center.y - cardSize.height / 2, world.height - cardSize.height - 90)),
  } : connection
  const [expanded, setExpanded] = useState(false)
  const extension = useMotionValue(reduced ? 1 : 0)
  const bandClip = useTransform(() => connectorBand(layout.center, connection?.end ?? layout.center, extension.get(), unit))
  const frontX = useTransform(() => (layout.center.x + ((connection?.end.x ?? layout.center.x) - layout.center.x) * extension.get()) * unit)
  const frontY = useTransform(() => (layout.center.y + ((connection?.end.y ?? layout.center.y) - layout.center.y) * extension.get()) * unit)
  const ready = placement !== null
  const progress = useMotionValue(reduced ? 1 : 0)
  const clipPath = useTransform(progress, value => `inset(${-10 * value}% ${100 - 110 * value}% ${-20 * value}% ${-10 * value}%)`)

  useLayoutEffect(() => {
    const element = cardRef.current!
    const measure = () => {
      const bounds = element.getBoundingClientRect()
      const width = bounds.width / unit
      const height = bounds.height / unit
      setCardSize(previous => previous?.width === width && previous.height === height ? previous : { width, height })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [unit])

  useEffect(() => {
    if (!ready || direct) return
    const playback = animate(extension, 1, { duration: reduced ? 0 : CARD_TIMING.connector, ease: SWEEP_EASE, onComplete: () => setExpanded(true) })
    return () => playback.stop()
  }, [extension, ready, reduced, direct])

  useEffect(() => {
    if (direct) return
    const playback = animate(progress, expanded || reduced ? 1 : 0, { duration: reduced ? 0 : CARD_TIMING.reveal, ease: SWEEP_EASE })
    return () => playback.stop()
  }, [expanded, reduced, progress, direct])

  return <motion.div className="selection" initial={direct && !reduced ? { opacity: 0 } : false} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : direct ? 0.35 : 0.12 }}>
    {connection && <motion.div className="connector-inversion" style={{ clipPath: bandClip, backdropFilter: `url(#${filterId})` }} aria-hidden="true" />}
    {connection && <svg className="connector" viewBox={`0 0 ${world.width} ${world.height}`} preserveAspectRatio="none" aria-hidden="true">
      {/* Each channel maps to blue + paper - background, swapping the two scene colors. */}
      <defs><filter id={filterId} colorInterpolationFilters="sRGB"><feColorMatrix type="matrix" values="-1 0 0 0 1.239215686 0 -1 0 0 1.356862745 0 0 -1 0 1.921568627 0 0 0 1 0" /></filter></defs>
      <rect className="connector-origin" x={layout.center.x - 7} y={layout.center.y - 7} width="14" height="14" />
    </svg>}
    {connection && <motion.span className="connector-endpoint" style={{ left: frontX, top: frontY }} aria-hidden="true" />}
    <motion.article ref={cardRef} id="island-card" className={`island-card${island.friend ? ' friend-card' : ''}${island.ty === 'note' ? ' note-card' : ''}`} aria-live="polite" style={{ clipPath: direct ? 'none' : clipPath, left: placement ? placement.left * unit : 0, top: placement ? placement.top * unit : 0, visibility: placement ? 'visible' : 'hidden' }} aria-label={island.title}>
      {island.ty !== 'note' && <a className="card-open" href={island.friend?.link ?? islandPath(island.id)} target={island.friend ? '_blank' : undefined} rel={island.friend ? 'noreferrer' : undefined} aria-label={`${island.friend ? '访问' : '阅读'} ${island.title}`} />}
      <span className="card-caption">{island.friend ? `// Friend #${String(index).padStart(2, '0')}` : '// Island'}</span>
      {island.friend ? <>
        <img className="friend-avatar" src={island.friend.avatar} alt={`${island.title} 的头像`} />
        <div className="friend-copy"><h1><span>{island.title}</span></h1><p>{island.desc}</p></div>
      </> : <>
        <div className="card-heading"><h1>{island.title}</h1></div>
        <div className="card-rule"><span className="card-index">#{String(index).padStart(2, '0')}</span></div>
        {island.ty === 'note' ? <div className="card-body" role="region" aria-label="岛屿正文" tabIndex={0}><IslandBody id={island.id} body={island.body ?? ''} encrypted={island.encrypted ?? false} /></div> : island.desc && <p className="card-description">{island.desc}</p>}
        <ul className="tags flex flex-wrap justify-end" aria-label="标签">{island.tags.map(tag => <li className="tag" key={tag}><span>{tag}</span>{[0, 1, 2, 3].map(corner => <i key={corner} className={`tag-corner tag-corner-${corner}`} aria-hidden="true" />)}</li>)}</ul>
        <span className="card-date">{island.date ? <time dateTime={island.date}>{new Intl.DateTimeFormat('sv-SE', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Shanghai' }).format(new Date(island.date))}</time> : 'long term project'}</span>
      </>}
      <button type="button" className={`close-card${island.friend ? ' friend-close' : ''}`} aria-label="关闭岛屿卡片" onClick={onClose}>{island.friend ? <svg viewBox="0 0 30 30" aria-hidden="true"><path fill="var(--blue)" d="M20 0h10v10H20Z" /><path fill="var(--gray)" d="M10 10h10v10H10ZM0 20h10v10H0ZM20 20h10v10H20Z" /></svg> : <svg className="card-pixels" viewBox="0 0 30 30" aria-hidden="true"><path d="M0 0h10v10H0ZM20 0h10v10H20ZM10 10h10v10H10ZM20 20h10v10H20Z" /></svg>}</button>
      <span className="corners" aria-hidden="true">{[0, 1, 2, 3].filter(corner => island.friend || corner !== connection?.corner).map(corner => <span key={corner} className={`corner corner-${corner} filled`} />)}</span>
    </motion.article>
  </motion.div>
}

export function IslandMap({ items, mode, page, setPage, playbackVideo }: { items: MapItem[]; mode: 'log' | 'friends'; page: number; setPage: (page: number) => void; playbackVideo?: RefObject<HTMLVideoElement | null> }) {
  const hideIslands = playbackVideo !== undefined
  const reduced = useReducedMotion()
  const scene = useRef<HTMLElement>(null)
  const mapItems = useRef<HTMLDivElement>(null)
  const [labelSizes, setLabelSizes] = useState<Record<string, { width: number; height: number }>>({})
  const id = useId().replaceAll(':', '')
  const [windowStart, setWindowStart] = useState(page)
  const [selected, setSelected] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const dragControls = useDragControls()
  const dragged = useRef(false)
  const panX = useMotionValue(0)
  const panY = useMotionValue(0)
  const [size, setSize] = useState({ width: window.innerWidth, height: Math.max(window.innerHeight, window.innerWidth <= 800 ? 680 : 540) })
  const [day, setDay] = useState(() => new Date().toISOString().slice(0, 10))
  const count = Math.ceil(items.length / PAGE_SIZE)
  const visible = useMemo(() => items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [items, page])
  const narrow = window.matchMedia('(max-width: 800px)').matches
  const unit = narrow ? 1 : window.innerWidth / 1188
  const world = { width: size.width / unit, height: size.height / unit }
  const grid = logGrid(world.width)
  const layouts = useMemo(() => islandLayouts(visible.map(island => island.id), day, world.width, world.height, labelSizes), [visible, day, world.width, world.height, labelSizes])
  const mapBounds = {
    left: Math.min(...layouts.map(layout => layout.bounds.left)) - grid.size,
    top: Math.min(...layouts.map(layout => layout.bounds.top)) - grid.size,
    right: Math.max(...layouts.map(layout => layout.bounds.right)) + grid.size,
    bottom: Math.max(...layouts.map(layout => layout.bounds.bottom)) + grid.size,
  }
  for (const [index, island] of visible.entries()) {
    const label = labelSizes[island.id]
    if (!label) continue
    const center = layouts[index].center
    mapBounds.left = Math.min(mapBounds.left, center.x - label.width / 2 - grid.size)
    mapBounds.right = Math.max(mapBounds.right, center.x + label.width / 2 + grid.size)
    mapBounds.top = Math.min(mapBounds.top, center.y - label.height / 2 - grid.size)
    mapBounds.bottom = Math.max(mapBounds.bottom, center.y + label.height / 2 + grid.size)
  }
  const area = mode === 'friends' ? { left: 16 * unit, top: 96 * unit, right: size.width - 16 * unit, bottom: size.height - (count > 1 ? 96 : 16) * unit } : { left: 0, top: 0, right: size.width, bottom: size.height }
  const mapScale = mode === 'friends' ? Math.min(1, Math.max(1, area.right - area.left) / ((mapBounds.right - mapBounds.left) * unit), Math.max(1, area.bottom - area.top) / ((mapBounds.bottom - mapBounds.top) * unit)) : 1
  const mapUnit = unit * mapScale
  const horizontalCenter = (area.left + area.right - (mapBounds.right + mapBounds.left) * mapUnit) / 2
  const verticalCenter = (area.top + area.bottom - (mapBounds.bottom + mapBounds.top) * mapUnit) / 2
  const dragBounds = {
    left: Math.min(area.right - mapBounds.right * mapUnit, horizontalCenter), right: Math.max(area.left - mapBounds.left * mapUnit, horizontalCenter),
    top: Math.min(area.bottom - mapBounds.bottom * mapUnit, verticalCenter), bottom: Math.max(area.top - mapBounds.top * mapUnit, verticalCenter),
  }
  const mapArea = {
    left: Math.min(mapBounds.left, -dragBounds.right / mapUnit), top: Math.min(mapBounds.top, -dragBounds.bottom / mapUnit),
    right: Math.max(mapBounds.right, (size.width - dragBounds.left) / mapUnit), bottom: Math.max(mapBounds.bottom, (size.height - dragBounds.top) / mapUnit),
  }
  const activeIndex = visible.findIndex(island => island.id === selected)
  const active = visible[activeIndex]
  const activeLayout = layouts[activeIndex]
  const selectionLayout = activeLayout && {
    center: { x: activeLayout.center.x * mapScale, y: activeLayout.center.y * mapScale },
    bounds: { left: activeLayout.bounds.left * mapScale, top: activeLayout.bounds.top * mapScale, right: activeLayout.bounds.right * mapScale, bottom: activeLayout.bounds.bottom * mapScale },
  }
  const shownPages = Math.min(narrow ? 3 : 4, count)
  const pageStart = Math.max(1, Math.min(windowStart, count - shownPages + 1))
  const pageNumbers = Array.from({ length: shownPages }, (_, i) => pageStart + i)
  const cells = useMemo(() => layouts.flatMap((layout, islandIndex) => layout.cells.map(([x, y]) => ({ x: layout.left + x * grid.size, y: layout.top + y * grid.size, islandIndex }))), [layouts, grid.size])

  useLayoutEffect(() => {
    if (!mapItems.current) return
    const labels = Array.from(mapItems.current.querySelectorAll<HTMLElement>('.island:not([inert]) .island-title'))
    const measure = () => {
      const next: Record<string, { width: number; height: number }> = {}
      for (const label of labels) {
        const id = label.closest<HTMLElement>('.island')!.dataset.islandId!
        const bounds = label.getBoundingClientRect()
        next[id] = { width: bounds.width / mapUnit, height: bounds.height / mapUnit }
      }
      setLabelSizes(previous => Object.keys(next).length === Object.keys(previous).length && Object.keys(next).every(id => previous[id] && Math.abs(previous[id].width - next[id].width) < 0.5 && Math.abs(previous[id].height - next[id].height) < 0.5) ? previous : next)
    }
    measure()
    const observer = new ResizeObserver(measure)
    for (const label of labels) observer.observe(label)
    return () => observer.disconnect()
  }, [visible, layouts, mapUnit])

  useLayoutEffect(() => {
    const x = Math.max(dragBounds.left, Math.min(0, dragBounds.right))
    const y = Math.max(dragBounds.top, Math.min(0, dragBounds.bottom))
    panX.set(x)
    panY.set(y)
  }, [page, day, dragBounds.left, dragBounds.right, dragBounds.top, dragBounds.bottom, panX, panY])

  useLayoutEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize(previous => previous.width === width && previous.height === height ? previous : { width, height })
    })
    observer.observe(scene.current!)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    const timer = window.setInterval(() => setDay(new Date().toISOString().slice(0, 10)), 60000)
    return () => clearInterval(timer)
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

  function turnAdjacent(direction: number) {
    const next = Math.max(1, Math.min(count, page + direction))
    let start = pageStart
    if (next <= start) start = next - 1
    else if (next >= start + shownPages - 1) start = next - shownPages + 2
    setWindowStart(Math.max(1, Math.min(start, count - shownPages + 1)))
    turn(next)
  }

  function turnNumber(next: number) {
    if (next === pageStart) setWindowStart(Math.max(1, pageStart - 1))
    else if (next === pageStart + shownPages - 1) setWindowStart(Math.min(count - shownPages + 1, pageStart + 1))
    turn(next)
  }

  function pageButton(number: number, label: string, text: string, disabled = false, onClick = () => turnNumber(number)) {
    return <button className="page-button" type="button" key={label} aria-label={label} aria-current={page === number && text === String(number) ? 'page' : undefined} disabled={disabled} onClick={onClick}>
      <span className="page-button-label">{text}</span><span className="page-button-cover" aria-hidden="true">{text}</span>
    </button>
  }

  return <main ref={scene} className={`log ${mode === 'friends' ? 'neighbourhood ' : ''}scene relative isolate overflow-hidden`} style={{ '--land-size': `${grid.size * unit}px` } as CSSProperties}>
    <MapBackground image={active?.friend?.background} pan={{ panX, panY }} />
    <header className="log-header flex items-start justify-between">
      {mode === 'log' && !hideIslands && <div className="directory">
        <button className="directory-toggle" type="button" aria-expanded={menuOpen} aria-controls="directory-list" onClick={() => setMenuOpen(value => !value)}><span className="hamburger" aria-hidden="true" />目录</button>
        <span className="directory-marker" aria-hidden="true" />
        <AnimatePresence>{menuOpen && <motion.nav className="directory-list" id="directory-list" aria-label="岛屿目录" initial={{ clipPath: 'inset(0% 0% 100% 0%)' }} animate={{ clipPath: 'inset(-5% -5% -5% -5%)' }} exit={{ clipPath: 'inset(0% 0% 100% 0%)' }} transition={{ duration: reduced ? 0 : 0.32, ease: SWEEP_EASE }}>
          {items.map((island, i) => island.ty === 'external'
            ? <a key={island.id} href={island.ref ?? undefined} target="_blank" rel="noopener noreferrer" onClick={() => setMenuOpen(false)}><span>{String(i + 1).padStart(2, '0')}</span>{island.title}</a>
            : <button key={island.id} type="button" onClick={() => { setPage(Math.floor(i / PAGE_SIZE) + 1); setSelected(island.ty === 'achievement' ? null : island.id); setMenuOpen(false) }}><span>{String(i + 1).padStart(2, '0')}</span>{island.title}</button>)}
        </motion.nav>}</AnimatePresence>
      </div>}
      <a href="/" className="site-link" aria-label="返回首页"><span>Crepuscular<br />Archipelago</span><span className="barcode" aria-hidden="true" /></a>
    </header>
    {playbackVideo && <VideoIslands video={playbackVideo} grid={grid} unit={unit} panX={panX} panY={panY} />}
    {!hideIslands && <div className="island-map" aria-label={`第 ${page} 页，共 ${visible.length} 个岛屿`} onPointerDown={event => {
      dragged.current = false
      if ((event.target as Element).closest('.selection')) return
      dragControls.start(event)
    }} onClickCapture={event => { if (dragged.current) { event.preventDefault(); event.stopPropagation() } }} onClick={event => {
      if (!(event.target as Element).closest('.island, .selection')) setSelected(null)
    }}>
      <motion.div ref={mapItems} className="map-items" drag dragControls={dragControls} dragListener={false} dragConstraints={dragBounds} dragElastic={0} dragMomentum={false} style={{ x: panX, y: panY, ...{ '--u': `${mapUnit}px`, '--land-size': `${grid.size * mapUnit}px` } }}  onDragStart={() => { dragged.current = true }}>
        <svg className="terrain-map" style={{ left: mapArea.left * mapUnit, top: mapArea.top * mapUnit, width: (mapArea.right - mapArea.left) * mapUnit, height: (mapArea.bottom - mapArea.top) * mapUnit }} viewBox={`${mapArea.left} ${mapArea.top} ${mapArea.right - mapArea.left} ${mapArea.bottom - mapArea.top}`} preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <clipPath id={`${id}-land`}><TerrainCells cells={cells} size={grid.size} fade={mode === 'friends'} /></clipPath>
            {activeLayout && <>
              <clipPath id={`${id}-selected`}><path d={activeLayout.shape} /></clipPath>
              <filter id={`${id}-outline`} filterUnits="userSpaceOnUse" x={activeLayout.bounds.left - 1} y={activeLayout.bounds.top - 1} width={activeLayout.bounds.right - activeLayout.bounds.left + 2} height={activeLayout.bounds.bottom - activeLayout.bounds.top + 2} colorInterpolationFilters="sRGB">
                <feMorphology in="SourceAlpha" operator="dilate" radius={ISLAND_OUTLINE.gap + ISLAND_OUTLINE.width} result="outer" />
                <feMorphology in="SourceAlpha" operator="dilate" radius={ISLAND_OUTLINE.gap} result="inner" />
                <feComposite in="outer" in2="inner" operator="out" result="ring" />
                <feFlood floodColor="var(--blue)" />
                <feComposite in2="ring" operator="in" />
              </filter>
            </>}
            <pattern id={`${id}-grid`} patternUnits="userSpaceOnUse" x={grid.x} y={grid.y} width={grid.size} height={grid.size}><path d={`M${grid.size},0H0V${grid.size}`} fill="none" stroke="var(--paper)" strokeWidth={ISLAND_GRID_WIDTH} /></pattern>
          </defs>
          <rect className="island-fill" x={mapArea.left} y={mapArea.top} width={mapArea.right - mapArea.left} height={mapArea.bottom - mapArea.top} clipPath={`url(#${id}-land)`} />
          <foreignObject x={mapArea.left} y={mapArea.top} width={mapArea.right - mapArea.left} height={mapArea.bottom - mapArea.top} clipPath={`url(#${id}-land)`}><Contours variant={hash(day) % 100} frameRate={30} scale={3} /></foreignObject>
          <rect className="terrain-grid" x={mapArea.left} y={mapArea.top} width={mapArea.right - mapArea.left} height={mapArea.bottom - mapArea.top} fill={`url(#${id}-grid)`} />
          <TerrainCells cells={cells} size={grid.size} borders selectedIndex={activeIndex} fade={mode === 'friends'} />
          {activeLayout && <>
            <path className="selected-outline" d={activeLayout.shape} fill="var(--blue)" filter={`url(#${id}-outline)`} />
            <path className="selected-land" d={activeLayout.shape} fill="var(--blue)" />
            <rect className="selected-grid" x={mapArea.left} y={mapArea.top} width={mapArea.right - mapArea.left} height={mapArea.bottom - mapArea.top} fill={`url(#${id}-grid)`} clipPath={`url(#${id}-selected)`} />
          </>}
        </svg>
        <AnimatePresence initial={false}>{visible.map((island, i) => <IslandTile key={`${island.id}:${layouts[i].center.x}:${layouts[i].center.y}`} island={island} index={i} layout={layouts[i]} unit={mapUnit} selected={selected === island.id} onSelect={() => setSelected(value => value === island.id ? null : island.id)} />)}</AnimatePresence>
      </motion.div>
      <AnimatePresence>{active && activeLayout && <IslandSelection key={active.id} island={active} layout={selectionLayout} world={world} unit={unit} panX={panX} panY={panY} index={(page - 1) * PAGE_SIZE + activeIndex + 1} onClose={() => setSelected(null)} />}</AnimatePresence>
    </div>}
    {!hideIslands && (mode === 'log' || count > 1) && <footer className="log-footer flex items-end justify-between"><span className="page-coordinate">{mode === 'friends' ? 'FRIENDS' : 'ISLANDS'} {String((page - 1) * PAGE_SIZE + 1).padStart(2, '0')}—{String(Math.min(page * PAGE_SIZE, items.length)).padStart(2, '0')} / {items.length}</span>
      <nav className="pagination flex items-center" aria-label="日志分页">
        {pageButton(page - 1, '上一页', '<', page === 1, () => turnAdjacent(-1))}
        {pageNumbers.map(number => pageButton(number, `第 ${number} 页`, String(number)))}
        {pageButton(page + 1, '下一页', '>', page === count, () => turnAdjacent(1))}
      </nav>
    </footer>}
  </main>
}
