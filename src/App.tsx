import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type MouseEvent } from 'react'
import { Home } from './Home'
import { Log } from './Log'
import { Island } from './Island'
import { Metadata } from './Metadata'
import { Neighbourhood } from './Neighbourhood'
import islands from './generated/islands.json'
import { islandId } from './island-content'

const WIPE = { duration: 0.65, width: 8, widthScale: 10, steps: 128 } as const
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

function subscribeReducedMotion(onChange: () => void) {
  const media = window.matchMedia(REDUCED_MOTION)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

type PageLocation = { key: number; path: string; url: string }

function pageLocation(url: Pick<Location, 'pathname' | 'search' | 'hash'>, key: number): PageLocation {
  return { key, path: url.pathname.replace(/\/$/, '') || '/', url: url.pathname + url.search + url.hash }
}

function Page({ path }: { path: string }) {
  if (path === '/') return <Home />
  if (path === '/log') return <Log />
  if (path === '/metadata') return <Metadata />
  if (path === '/neighbourhood') return <Neighbourhood />

  const id = islandId(path)
  return id !== null ? <Island id={id} /> : <main className="missing"><h1>404 · 这片海域等待探索</h1><a className="frame-button" href="/">返回群岛</a></main>
}

export function App() {
  const root = useRef<HTMLDivElement>(null)
  const sequence = useRef(0)
  const incomingView = useRef<HTMLDivElement>(null)
  const wipeBar = useRef<HTMLDivElement>(null)
  const reduced = useSyncExternalStore(subscribeReducedMotion, () => window.matchMedia(REDUCED_MOTION).matches)
  const [current, setCurrent] = useState(() => pageLocation(window.location, 0))
  const [requested, setRequested] = useState(current)
  const [entering, setEntering] = useState<PageLocation | null>(null)
  const [oldScroll, setOldScroll] = useState(0)

  useEffect(() => {
    const restore = () => setRequested(pageLocation(window.location, ++sequence.current))
    window.addEventListener('popstate', restore)
    return () => window.removeEventListener('popstate', restore)
  }, [])

  useEffect(() => {
    if (entering || requested.url === current.url) return
    setOldScroll(window.scrollY)
    window.scrollTo(0, 0)
    if (reduced) setCurrent(requested)
    else setEntering(requested)
  }, [requested, current.url, entering, reduced])

  useLayoutEffect(() => {
    if (!entering) return
    const options: KeyframeAnimationOptions = { duration: reduced ? 0 : WIPE.duration * 1000, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', fill: 'both' }
    const reveal = incomingView.current!.animate([{ transform: `translateX(${-100 - WIPE.width}vw)` }, { transform: 'translateX(0vw)' }], options)
    const content = incomingView.current!.firstElementChild!.animate([{ transform: `translateX(${100 + WIPE.width}vw)` }, { transform: 'translateX(0vw)' }], options)
    const band = wipeBar.current!.animate(Array.from({ length: WIPE.steps + 1 }, (_, step) => {
      const progress = step / WIPE.steps
      return { offset: progress, transform: `translateX(${-WIPE.width + (100 + WIPE.width) * progress}vw) scaleX(${1 + (WIPE.widthScale - 1) * progress ** 2})` }
    }), options)
    reveal.startTime = content.startTime = band.startTime = document.timeline.currentTime
    reveal.onfinish = () => {
      setCurrent(entering)
      setEntering(null)
    }
    return () => { reveal.onfinish = null; reveal.cancel(); content.cancel(); band.cancel() }
  }, [entering, reduced])

  useEffect(() => {
    const page = entering ?? current
    const island = islands.find(item => item.id === islandId(page.path))
    const titles: Record<string, string> = { '/': 'Crepuscular Archipelago · 443eb9#C', '/log': '日志 · Crepuscular Archipelago', '/metadata': '元数据 · Crepuscular Archipelago', '/neighbourhood': '邻域 · Crepuscular Archipelago' }
    document.title = island ? `${island.title} · Crepuscular Archipelago` : titles[page.path] ?? '404 · Crepuscular Archipelago'
    if (!entering) root.current?.querySelector<HTMLElement>('[data-page-view]')?.focus({ preventScroll: true })
  }, [current, entering])

  function navigate(event: MouseEvent<HTMLDivElement>) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const link = (event.target as Element).closest<HTMLAnchorElement>('a[href]')
    if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return
    if (link.origin !== window.location.origin) return
    const location = pageLocation(link, sequence.current + 1)
    if (location.path === requested.path && link.search === window.location.search) {
      if (link.hash === window.location.hash) event.preventDefault()
      return
    }
    event.preventDefault()
    window.history.pushState(null, '', location.url)
    sequence.current++
    setRequested(location)
  }

  return <div ref={root} className="page-router" onClick={navigate}>
    {[current, ...(entering ? [entering] : [])].map(page => {
      const incoming = page.key === entering?.key
      return <div key={page.key} ref={incoming ? incomingView : undefined} data-page-view className={`page-view${entering ? incoming ? ' page-incoming' : ' page-outgoing' : ''}`} tabIndex={-1} inert={Boolean(entering)} aria-hidden={entering ? true : undefined} style={incoming ? { transform: `translateX(${-100 - WIPE.width}vw)` } : undefined}>
        <div className="page-content" style={incoming ? { transform: `translateX(${100 + WIPE.width}vw)` } : entering ? { transform: `translateY(${-oldScroll}px)` } : undefined}><Page path={page.path} /></div>
      </div>
    })}
    {entering && <div ref={wipeBar} className="page-wipe" style={{ width: `${WIPE.width}vw`, transform: `translateX(${-WIPE.width}vw)` }} aria-hidden="true" />}
  </div>
}
