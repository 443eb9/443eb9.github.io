import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { Contours } from './Fields'
import { nearbyCharacters } from './scan'
import roadmap from './roadmap.json'
import './lapiz-roadmap.css'

const statuses = [
  { id: 'completed', label: '已完成' },
  { id: 'in_progress', label: '进行中' },
  { id: 'todo', label: '待办' },
] as const
const tasks = roadmap.flatMap(stage => stage.tasks)
const filters = [
  { id: 'all', label: '全部', count: tasks.length },
  ...statuses.map(status => ({ ...status, count: tasks.filter(task => task.status === status.id).length })),
] as const

const CLUSTER_RADIUS = 56
const CLUSTER_COUNT = 9

function createSquareClusters() {
  return Array.from({ length: CLUSTER_COUNT }, () => {
    const x = Math.random()
    const y = Math.random()
    const squares = Array.from({ length: 1 + Math.floor(Math.random() * 3) }, () => {
      const angle = Math.random() * 2 * Math.PI
      const distance = Math.sqrt(Math.random()) * CLUSTER_RADIUS
      return { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance, size: 9 + Math.floor(Math.random() * 28) }
    })

    return { x, y, squares }
  })
}

function LapizBackdrop() {
  const [clusters] = useState(createSquareClusters)

  return <div className="lapiz-backdrop" aria-hidden="true">
    <Contours scale={1.8} frameRate={60} pixelRatio={1} />
    {clusters.map((cluster, index) => <div key={index} className="lapiz-square-cluster" style={{ left: `${cluster.x * 100}%`, top: `${cluster.y * 100}%` }}>
      {cluster.squares.map((square, squareIndex) => <i key={squareIndex} style={{ left: square.x, top: square.y, width: square.size }} />)}
    </div>)}
  </div>
}

const REVEAL_FRAMES = 18
const FIRST_SETTLED_FRAME = 3
const REVEAL_DURATION = 1000
const RevealFrame = createContext(REVEAL_FRAMES)
const RevealCharacters = createContext<((character: string) => string[]) | null>(null)

function createRevealCharacters(context: CanvasRenderingContext2D) {
  context.font = '12px "Ark Pixel", monospace'
  const choicesByCharacter = new Map<string, string[]>()

  return (character: string) => {
    const previous = choicesByCharacter.get(character)
    if (previous) return previous

    const width = context.measureText(character).width
    const choices = nearbyCharacters(character).filter(candidate => context.measureText(candidate).width <= width)
    choicesByCharacter.set(character, choices)
    return choices
  }
}

function RoadmapText({ children }: { children: string }) {
  const frame = useContext(RevealFrame)
  const chooseCharacters = useContext(RevealCharacters)
  const revealing = frame < REVEAL_FRAMES
  const glyphs = useMemo(() => revealing && chooseCharacters ? Array.from(children, character => ({
    character,
    choices: /\s/u.test(character) ? [] : chooseCharacters(character),
  })) : [], [children, chooseCharacters, revealing])

  const scrambled = glyphs.map(({ character, choices }, index) => {
    if (!choices.length) return character
    const code = character.codePointAt(0)!
    const order = (Math.imul(index + 1, 2654435761) ^ Math.imul(code, 1597334677)) >>> 0
    const settleAt = FIRST_SETTLED_FRAME + order % (REVEAL_FRAMES - FIRST_SETTLED_FRAME + 1)
    if (frame >= settleAt) return character

    return choices[((order >>> 8) + frame) % choices.length]
  }).join('')

  return <span className="lapiz-text">
    <span className="lapiz-text-correct">{children}</span>
    {revealing && chooseCharacters && <span className="lapiz-text-scrambled" aria-hidden="true">{scrambled}</span>}
  </span>
}

export function LapizRoadmap() {
  const [filter, setFilter] = useState<(typeof filters)[number]['id']>('all')
  const [frame, setFrame] = useState(0)
  const [chooseCharacters, setChooseCharacters] = useState<((character: string) => string[]) | null>(null)
  const reduced = useReducedMotion()
  const revealFrame = reduced ? REVEAL_FRAMES : frame

  useEffect(() => {
    if (reduced) return
    let active = true
    let start = 0
    let timer = 0

    function scheduleFrame(next: number) {
      const progress = next / REVEAL_FRAMES
      // Invert the quadratic ease-out to schedule each discrete frame.
      const time = (3 - Math.sqrt(9 - 8 * progress)) / 2
      timer = window.setTimeout(() => {
        setFrame(next)
        if (next < REVEAL_FRAMES) scheduleFrame(next + 1)
      }, Math.max(0, start + time * REVEAL_DURATION - performance.now()))
    }

    void document.fonts.ready.then(() => {
      if (!active) return
      const context = document.createElement('canvas').getContext('2d')
      if (!context) {
        setFrame(REVEAL_FRAMES)
        return
      }

      setChooseCharacters(() => createRevealCharacters(context))
      start = performance.now()
      scheduleFrame(1)
    })

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [reduced])

  return <RevealFrame.Provider value={revealFrame}><RevealCharacters.Provider value={chooseCharacters}><main className="lapiz-roadmap scene" data-revealing={revealFrame < REVEAL_FRAMES}>
    <LapizBackdrop />
    <header className="lapiz-header">
      <span><i aria-hidden="true" /><RoadmapText>LAPIZ / ROADMAP</RoadmapText></span>
      <a href="/"><span aria-hidden="true">← </span><RoadmapText>返回群岛</RoadmapText></a>
    </header>

    <div className="lapiz-hero">
      <h1><span lang="en"><RoadmapText>Lapiz</RoadmapText></span> <span className="lapiz-subtitle"><RoadmapText>开发路线图</RoadmapText></span></h1>
    </div>

    <div className="lapiz-toolbar">
      <div className="lapiz-filters" role="group" aria-label="按任务状态筛选">
        {filters.map(({ id, label, count }) => {
          const content = <>
            {id !== 'all' && <span className="lapiz-status" data-status={id} aria-hidden="true" />}
            <RoadmapText>{label}</RoadmapText><span className="lapiz-filter-count"><RoadmapText>{String(count)}</RoadmapText></span>
          </>

          return <button key={id} className="frame-button" type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}>
            <span className="button-label">{content}</span>
            <span className="button-cover" aria-hidden="true">{content}</span>
          </button>
        })}
      </div>
      <p className="lapiz-result" role="status"><RoadmapText>{`显示 ${filters.find(item => item.id === filter)?.count} / ${tasks.length} 项`}</RoadmapText></p>
    </div>

    <div className="lapiz-stages">
      {roadmap.map((stage, index) => {
        const id = `lapiz-stage-${index + 1}`
        const visible = filter === 'all' ? stage.tasks : stage.tasks.filter(task => task.status === filter)

        return <section key={stage.version} className="lapiz-stage" aria-labelledby={id}>
          <header className="lapiz-stage-header">
            <p className="lapiz-stage-index"><span><RoadmapText>{`阶段 ${String(index + 1).padStart(2, '0')}`}</RoadmapText></span><RoadmapText>{`${visible.length} 项`}</RoadmapText></p>
            <h2 id={id}><RoadmapText>{stage.version}</RoadmapText></h2>
            {stage.codename && <p className="lapiz-codename" lang="en"><RoadmapText>{stage.codename}</RoadmapText></p>}
            <p className="lapiz-stage-description"><RoadmapText>{stage.description}</RoadmapText></p>
          </header>
          {visible.length ? <ul className="lapiz-tasks" role="list">
            {visible.map(task => <li key={task.title} className="lapiz-task" data-status={task.status}>
              <span className="lapiz-status" data-status={task.status} aria-hidden="true" />
              {[0, 1, 2, 3].map(corner => <i key={corner} className={`tag-corner tag-corner-${corner}`} aria-hidden="true" />)}
              <div>
                <h3><RoadmapText>{task.title}</RoadmapText></h3>
                <span className="sr-only">{statuses.find(status => status.id === task.status)?.label}</span>
                <p><RoadmapText>{task.description}</RoadmapText></p>
              </div>
            </li>)}
          </ul> : <p className="lapiz-empty"><RoadmapText>这个阶段没有符合条件的任务</RoadmapText></p>}
        </section>
      })}
    </div>

    <footer className="lapiz-footer"><RoadmapText>LAPIZ / ROADMAP</RoadmapText></footer>
  </main></RevealCharacters.Provider></RevealFrame.Provider>
}
