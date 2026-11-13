import Markdown from 'react-markdown'
import { markdownPlugins } from './markdown'
import islands from './generated/islands.json'
import { Contours } from './Fields'
import { IslandComments } from './IslandComments'
import { encryptedSections, islandAssetUrl, islandRouteId } from './island-content'

const whiteBlocks = [[19.3, 55.6, 12.8, 16], [5.9, 71.8, 13.6, 11.5], [19.5, 77.4, 12.6, 15.7], [5.8, 87.4, 13.7, 11.5], [76.2, 71.3, 20.8, 13]]
const blueBlocks = [[77, 16.5, 2.5], [92.4, 23.5, 0.8], [16.7, 66.8, 2.5], [14.9, 71.1, 1.2], [19.5, 72.9, 1.6], [3.3, 90.6, 2.5], [90.6, 81.5, 2.5], [96.8, 89.6, 0.8], [73.4, 94.2, 2.2]]

export function Island({ id }: { id: string }) {
  const index = islands.findIndex(island => islandRouteId(island.id) === id)
  const island = islands[index]
  if (!island) return <main className="missing"><h1>404 · 这片海域等待探索</h1><a className="frame-button" href="/log">返回日志</a></main>

  return <main className="island-detail scene">
    <div className="island-backdrop" aria-hidden="true">
      <div className="island-silhouette" />
      <Contours scale={1.8} frameRate={60} pixelRatio={1} />
      {blueBlocks.map(([left, top, width], i) => <i key={`blue-${i}`} className="detail-blue-block" style={{ left: `${left}%`, top: `${top}%`, width: `${width}%` }} />)}
      {whiteBlocks.map(([left, top, width, height], i) => <i key={`white-${i}`} className="detail-white-block" style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }} />)}
      <span className="detail-unknown">UNKNOWN</span><span className="detail-alert">[!]</span><span className="detail-browser">LOG BROWSER</span>
    </div>
    <aside className="detail-sidebar">
      <header className="detail-summary detail-frame">
        <h1>{island.title}</h1>
        {island.desc && <p>{island.desc}</p>}
        <span className="detail-date">{island.date ? <time dateTime={island.date}>{new Intl.DateTimeFormat('sv-SE', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Shanghai' }).format(new Date(island.date))}</time> : 'long term project'}</span>
        <FrameCorners />
      </header>
      <ul className="tags detail-tags" aria-label="标签">{island.tags.map(tag => <li className="tag" key={tag}><span>{tag}</span>{[0, 1, 2, 3].map(corner => <i key={corner} className={`tag-corner tag-corner-${corner}`} aria-hidden="true" />)}</li>)}</ul>
    </aside>
    <article className="detail-body detail-frame" aria-label={island.title}>
      <span className="detail-caption">// Island #{String(index + 1).padStart(2, '0')}</span>
      <div className="detail-scroll" role="region" aria-label="岛屿正文" tabIndex={0}>
        <div className="detail-article-content"><IslandBody id={island.id} body={island.body} encrypted={island.encrypted} /></div>
        <IslandComments key={island.id} title={island.title} />
      </div>
      <FrameCorners />
    </article>
    <a className="detail-close" href="/log" aria-label="返回日志">X</a>
  </main>
}

export function IslandBody({ id, body, encrypted }: { id: string; body: string; encrypted: boolean }) {
  if (encrypted) return <pre className="island-ciphertext" aria-label="AES 加密内容" data-encryption-context={`island:${id}`}>{body}</pre>

  let sectionIndex = 0
  return <div className="island-markdown">{encryptedSections(body).map((section, index) => section.encrypted
    ? <pre key={index} className="island-ciphertext" aria-label="AES 加密内容" data-encryption-context={`island:${id}:section:${sectionIndex++}`}>{section.body.trim()}</pre>
    : <Markdown key={index} {...markdownPlugins} urlTransform={url => islandAssetUrl(url, id)} components={{ table: ({ children }) => <div className="markdown-table"><table>{children}</table></div>, img: ({ node: _node, ...props }) => <img {...props} loading="lazy" /> }}>{section.body}</Markdown>
  )}</div>
}

function FrameCorners() {
  return <span className="corners" aria-hidden="true">{[0, 1, 2, 3].map(corner => <span key={corner} className={`corner corner-${corner}`} />)}</span>
}
