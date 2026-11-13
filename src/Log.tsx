import { useCallback, useEffect, useRef, useState } from 'react'
import islands from './generated/islands.json'
import { IslandMap } from './IslandMap'

const SECRET = 'apple'
const VIDEO_VOLUME = 0.12

export function Log() {
  const root = useRef<HTMLDivElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [needsPlay, setNeedsPlay] = useState(false)

  const play = useCallback(() => {
    const media = video.current
    if (!media) return
    media.volume = VIDEO_VOLUME
    setNeedsPlay(false)
    media.play().catch(error => { if (error.name !== 'AbortError') setNeedsPlay(true) })
  }, [])

  const stop = useCallback(() => {
    const media = video.current
    if (media) {
      media.pause()
      if (media.readyState > 0) media.currentTime = 0
    }
    setPlaying(false)
    setNeedsPlay(false)
  }, [])

  useEffect(() => {
    let input = ''
    function keydown(event: KeyboardEvent) {
      const path = window.location.pathname.replace(/\/$/, '')
      const target = event.target
      if (path !== '/log' || root.current?.closest('[inert]') || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || (target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea, select')))) {
        input = ''
        return
      }
      if (playing) {
        if (event.key === 'Escape') { event.preventDefault(); stop() }
        return
      }
      if (event.repeat) return
      if (!/^[a-z]$/i.test(event.key)) { input = ''; return }
      input = (input + event.key.toLowerCase()).slice(-SECRET.length)
      if (input === SECRET) {
        event.preventDefault()
        input = ''
        setPlaying(true)
        play()
      }
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [playing, play, stop])

  useEffect(() => {
    const media = video.current
    return () => media?.pause()
  }, [])

  return <div ref={root} className={`log-page${playing ? ' log-playback' : ''}`}>
    <IslandMap items={islands} mode="log" playbackVideo={playing ? video : undefined} />
    <video ref={video} className="bad-apple-source" src="/media/bad-apple.mp4" preload="none" playsInline onEnded={stop} onPlaying={() => setNeedsPlay(false)} onError={() => setNeedsPlay(true)} aria-hidden="true" />
    <div className="bad-apple-stage" hidden={!playing} role="region" aria-label="Bad Apple 像素影像">
      {needsPlay && <button type="button" className="bad-apple-play" onClick={play}>点击播放视频与音频</button>}
      <button type="button" className="bad-apple-exit" onClick={stop}>Esc · 返回日志</button>
    </div>
  </div>
}
