import { useEffect, useState } from 'react'
import Markdown from 'react-markdown'
import { Contours } from './Fields'
import { markdownPlugins } from './markdown'

const socialLinks = [
  { id: 'github', label: 'Github', icon: 'github' },
  { id: 'email', label: 'Email', icon: 'mail' },
  { id: 'rednote', label: 'Rednote', icon: 'notebook' },
  { id: 'bilibili', label: 'Bilibili', icon: 'bilibili' },
  { id: 'x', label: 'X(Twitter)', icon: 'x' },
] as const

const whiteBlocks = [[8.9, 50.8, 17.1, 18.4], [85.3, 40.9, 14.4, 25.5], [2.9, 82, 7.5, 13.7], [86.7, 96.5, 13.3, 10]]
const blueBlocks = [[37.6, 2.2, 3.6], [-1.4, 37.4, 3.6], [6, 69.4, 1.9], [2.9, 74.8, 1.4], [19.1, 82.7, 2.8], [17.4, 86.7, 1.1], [88.6, 66.4, 2.9], [80.9, 79.4, 1.7], [83.2, 81.6, 1.1]]

export function Metadata() {
  const [intro, setIntro] = useState<string | null>(null)
  const [links, setLinks] = useState<Record<string, string>>({})
  const [error, setError] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      const [introResponse, linksResponse] = await Promise.all([
        fetch('/self-intro.md', { signal: controller.signal }),
        fetch('/metadata-links.json', { signal: controller.signal }),
      ])
      if (!introResponse.ok || !linksResponse.ok) throw new Error('Read metadata files failed.')
      const [text, configuration] = await Promise.all([introResponse.text(), linksResponse.json()])
      if (!configuration || typeof configuration !== 'object' || Array.isArray(configuration)) throw new Error('Metadata links must contain an object.')
      for (const { id } of socialLinks) {
        if (configuration[id] != null && typeof configuration[id] !== 'string') throw new Error(`Metadata link ${id} must contain a string.`)
      }
      if (controller.signal.aborted) return
      setIntro(text)
      setLinks(configuration)
    }
    load().catch(() => { if (!controller.signal.aborted) setError(true) })
    return () => controller.abort()
  }, [])

  return <main className="metadata scene">
    <div className="metadata-backdrop" aria-hidden="true">
      <Contours scale={1.8} frameRate={60} pixelRatio={1} />
      {whiteBlocks.map(([left, top, width, height], index) => <i key={`white-${index}`} className="detail-white-block" style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }} />)}
      {blueBlocks.map(([left, top, width], index) => <i key={`blue-${index}`} className="detail-blue-block" style={{ left: `${left}%`, top: `${top}%`, width: `${width}%` }} />)}
    </div>
    <aside className="metadata-identity">
      <a className="metadata-avatar" href="/" aria-label="返回首页"><img src="/images/avatar-original.png" alt="44eb9#C 的头像" /></a>
      <a className="metadata-name" href="/">44eb9#C</a>
    </aside>
    <article className="metadata-intro" aria-label="自我介绍" tabIndex={0}>
      {error ? <p role="alert">请刷新页面以重新读取资料。</p> : intro === null ? <p role="status">正在读取资料...</p> : <div className="island-markdown metadata-content"><Markdown {...markdownPlugins} urlTransform={url => url}>{intro}</Markdown></div>}
    </article>
    <nav className="metadata-social" aria-label="社交链接">{socialLinks.map(({ id, label, icon }) => {
      const value = links[id]?.trim()
      const href = id === 'email' && value && !/^[a-z][a-z\d+.-]*:/i.test(value) ? `mailto:${value}` : value
      const content = <><span className={`metadata-icon metadata-icon-${icon}`} aria-hidden="true" /><span>{label}</span></>
      return href ? <a key={id} className="metadata-link" href={href} target="_blank" rel="noreferrer">{content}</a> : <span key={id} className="metadata-link" aria-disabled="true" title="在 metadata-links.json 中填写链接">{content}</span>
    })}</nav>
  </main>
}
