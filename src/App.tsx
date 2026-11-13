import { useEffect, useRef, useState, useSyncExternalStore, type MouseEvent } from 'react'
import { animate, motion, useMotionValue, useTransform } from 'motion/react'
import { Home } from './Home'
import { Log } from './Log'

const WIPE = { duration: 0.65, width: 8, widthScale: 5 } as const
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
  return path === '/' ? <Home /> : path === '/log' ? <Log /> : <main className="missing"><h1>404 · 这片海域等待探索</h1><a className="frame-button" href="/">返回群岛</a></main>
}

export function App() {
  const root = useRef<HTMLDivElement>(null)
  const sequence = useRef(0)
  const reduced = useSyncExternalStore(subscribeReducedMotion, () => window.matchMedia(REDUCED_MOTION).matches)
  const [current, setCurrent] = useState(() => pageLocation(window.location, 0))
  const [requested, setRequested] = useState(current)
  const [entering, setEntering] = useState<PageLocation | null>(null)
  const [oldScroll, setOldScroll] = useState(0)
  const progress = useMotionValue(0)
  const reveal = useTransform(progress, value => `inset(0 ${(100 + WIPE.width) * (1 - value)}% 0 0)`)
  const barLeft = useTransform(progress, value => `${-WIPE.width + (100 + WIPE.width) * value}vw`)
  const barWidth = useTransform(progress, value => `${WIPE.width * (1 + (WIPE.widthScale - 1) * value ** 2)}vw`)

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
    else {
      progress.set(0)
      setEntering(requested)
    }
  }, [requested, current.url, entering, reduced, progress])

  useEffect(() => {
    if (!entering) return
    const playback = animate(progress, 1, {
      duration: reduced ? 0 : WIPE.duration,
      ease: [0.65, 0, 0.35, 1],
      onComplete: () => {
        setCurrent(entering)
        setEntering(null)
      },
    })
    return () => playback.stop()
  }, [entering, reduced, progress])

  useEffect(() => {
    const page = entering ?? current
    document.title = page.path === '/' ? 'Crepuscular Archipelago · 443eb9#C' : page.path === '/log' ? '日志 · Crepuscular Archipelago' : '404 · Crepuscular Archipelago'
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
      return <motion.div key={page.key} data-page-view className={`page-view${entering ? incoming ? ' page-incoming' : ' page-outgoing' : ''}`} tabIndex={-1} inert={Boolean(entering)} aria-hidden={entering ? true : undefined} style={incoming ? { clipPath: reveal } : undefined}>
        <div className="page-content" style={entering && !incoming ? { transform: `translateY(${-oldScroll}px)` } : undefined}><Page path={page.path} /></div>
      </motion.div>
    })}
    {entering && <motion.div className="page-wipe" style={{ width: barWidth, left: barLeft }} aria-hidden="true" />}
  </div>
}
