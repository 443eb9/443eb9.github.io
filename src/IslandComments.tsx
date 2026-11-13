import { useEffect, useRef, useState } from 'react'
import Giscus from '@giscus/react'

export function IslandComments({ title }: { title: string }) {
  const section = useRef<HTMLElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const element = section.current!
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting && entry.intersectionRatio > 0)) {
        setVisible(true)
        observer.disconnect()
      }
    }, { root: element.closest('.detail-scroll, .card-body'), threshold: 0.01 })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return <section ref={section} className="island-comments" aria-label="评论">
    <h2>评论</h2>
    {visible && <Giscus
      repo="443eb9/crepuscular-archipelago"
      repoId="R_kgDOLyot2Q"
      category="Giscus"
      categoryId="DIC_kwDOLyot2c4Cf7i_"
      mapping="specific"
      term={`${title} - Crepuscular Archipelago`}
      strict="1"
      reactionsEnabled="1"
      emitMetadata="0"
      inputPosition="bottom"
      theme="light"
      lang="zh-CN"
    />}
  </section>
}
