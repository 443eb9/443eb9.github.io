import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { Contours } from './Fields'
import { nearbyCharacters } from './scan'
import './lapiz-roadmap.css'

const statuses = ['completed', 'in_progress', 'todo'] as const
const filterIds = ['all', ...statuses] as const
const languages = ['zh-CN', 'en'] as const
const [chinese, english] = languages

type Language = (typeof languages)[number]
type Status = (typeof statuses)[number]
type TaskProgress = { id: string; status: Status }
type StageProgress = { id: string; codename?: string; tasks: TaskProgress[] }
type Proposal = { title: string; description: string }
type StageContent = Proposal & { tasks: Record<string, Proposal> }
type Stage = Omit<StageProgress, 'tasks'> & Proposal & { tasks: (TaskProgress & Proposal)[] }

const text = {
  [chinese]: {
    name: '简体中文', language: '切换语言', back: '返回群岛', subtitle: '开发路线图', filter: '按任务状态筛选',
    all: '全部', completed: '已完成', in_progress: '进行中', todo: '待办',
    result: (count: number, total: number) => `显示 ${count} / ${total} 项`,
    stage: (index: string) => `阶段 ${index}`, items: (count: number) => `${count} 项`,
    empty: '这个阶段没有符合条件的任务', loading: '正在加载路线图…', error: '无法加载路线图，请刷新重试。',
  },
  [english]: {
    name: 'English', language: 'Change language', back: 'Back to the archipelago', subtitle: 'Development roadmap', filter: 'Filter by task status',
    all: 'All', completed: 'Completed', in_progress: 'In progress', todo: 'To do',
    result: (count: number, total: number) => `Showing ${count} / ${total} ${total === 1 ? 'task' : 'tasks'}`,
    stage: (index: string) => `Stage ${index}`, items: (count: number) => `${count} ${count === 1 ? 'task' : 'tasks'}`,
    empty: 'No matching tasks in this stage', loading: 'Loading roadmap…', error: 'Could not load the roadmap. Refresh to try again.',
  },
}

function preferredLanguage(): Language {
  for (const preference of navigator.languages) {
    const primary = preference.toLowerCase().split('-')[0]
    if (primary === 'zh') return chinese
    if (primary === 'en') return english
  }

  return chinese
}

async function readRoadmapFile<T>(name: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(`/roadmap/${name}.json`, { signal })
  if (!response.ok) throw new Error(`Could not load roadmap file: ${name}`)
  return response.json()
}

async function loadRoadmap(language: Language, signal: AbortSignal): Promise<Stage[]> {
  const [progress, content] = await Promise.all([
    readRoadmapFile<StageProgress[]>('progress', signal),
    readRoadmapFile<Record<string, StageContent>>(language, signal),
  ])

  return progress.map(stage => {
    const { title, description, tasks } = content[stage.id]
    return { ...stage, title, description, tasks: stage.tasks.map(task => {
      const { title, description } = tasks[task.id]
      return { ...task, title, description }
    }) }
  })
}

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
  const [language, setLanguage] = useState(preferredLanguage)
  const [loaded, setLoaded] = useState<{ language: Language; stages: Stage[] | null }>()
  const [filter, setFilter] = useState<(typeof filterIds)[number]>('all')
  const [frame, setFrame] = useState(0)
  const [chooseCharacters, setChooseCharacters] = useState<((character: string) => string[]) | null>(null)
  const reduced = useReducedMotion()
  const revealFrame = reduced ? REVEAL_FRAMES : frame
  const labels = text[language]
  const roadmap = loaded?.language === language ? loaded.stages : undefined
  const tasks = roadmap?.flatMap(stage => stage.tasks) ?? []
  const counts = { all: tasks.length, completed: 0, in_progress: 0, todo: 0 }
  for (const task of tasks) counts[task.status]++

  useEffect(() => {
    const controller = new AbortController()
    void loadRoadmap(language, controller.signal).then(stages => {
      if (!controller.signal.aborted) setLoaded({ language, stages })
    }, () => {
      if (!controller.signal.aborted) setLoaded({ language, stages: null })
    })
    return () => controller.abort()
  }, [language])

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

  return <RevealFrame.Provider value={revealFrame}><RevealCharacters.Provider value={chooseCharacters}><main className="lapiz-roadmap scene" lang={language} data-revealing={revealFrame < REVEAL_FRAMES}>
    <LapizBackdrop />
    <header className="lapiz-header">
      <span><i aria-hidden="true" /><RoadmapText>LAPIZ / ROADMAP</RoadmapText></span>
      <div className="lapiz-header-actions">
        <a href="/"><span aria-hidden="true">← </span><RoadmapText>{labels.back}</RoadmapText></a>
        <select className="lapiz-language" aria-label={labels.language} title={labels.language} value={language} onChange={event => {
          const selected = languages.find(item => item === event.target.value)
          if (selected) setLanguage(selected)
        }}>
          {languages.map(item => <option key={item} value={item} lang={item}>{text[item].name}</option>)}
        </select>
      </div>
    </header>

    <div className="lapiz-hero">
      <h1><a href="https://github.com/lapiz-rs/lapiz" lang="en"><RoadmapText>Lapiz</RoadmapText></a> <span className="lapiz-subtitle"><RoadmapText>{labels.subtitle}</RoadmapText></span></h1>
    </div>

    {!roadmap ? <p className="lapiz-empty" role={roadmap === null ? 'alert' : 'status'}>{roadmap === null ? labels.error : labels.loading}</p> : <>
    <div className="lapiz-toolbar">
      <div className="lapiz-filters" role="group" aria-label={labels.filter}>
        {filterIds.map(id => {
          const content = <>
            {id !== 'all' && <span className="lapiz-status" data-status={id} aria-hidden="true" />}
            <RoadmapText>{labels[id]}</RoadmapText><span className="lapiz-filter-count"><RoadmapText>{String(counts[id])}</RoadmapText></span>
          </>

          return <button key={id} className="frame-button" type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}>
            <span className="button-label">{content}</span>
            <span className="button-cover" aria-hidden="true">{content}</span>
          </button>
        })}
      </div>
      <p className="lapiz-result" role="status"><RoadmapText>{labels.result(counts[filter], counts.all)}</RoadmapText></p>
    </div>

    <div className="lapiz-stages">
      {roadmap.map((stage, index) => {
        const id = `lapiz-stage-${index + 1}`
        const visible = filter === 'all' ? stage.tasks : stage.tasks.filter(task => task.status === filter)

        return <section key={stage.id} className="lapiz-stage" aria-labelledby={id}>
          <header className="lapiz-stage-header">
            <p className="lapiz-stage-index"><span><RoadmapText>{labels.stage(String(index + 1).padStart(2, '0'))}</RoadmapText></span><RoadmapText>{labels.items(visible.length)}</RoadmapText></p>
            <h2 id={id}><RoadmapText>{stage.title}</RoadmapText></h2>
            {stage.codename && <p className="lapiz-codename" lang="en"><RoadmapText>{stage.codename}</RoadmapText></p>}
            <p className="lapiz-stage-description"><RoadmapText>{stage.description}</RoadmapText></p>
          </header>
          {visible.length ? <ul className="lapiz-tasks" role="list">
            {visible.map(task => <li key={task.id} className="lapiz-task" data-status={task.status}>
              <span className="lapiz-status" data-status={task.status} aria-hidden="true" />
              {[0, 1, 2, 3].map(corner => <i key={corner} className={`tag-corner tag-corner-${corner}`} aria-hidden="true" />)}
              <div>
                <h3><RoadmapText>{task.title}</RoadmapText></h3>
                <span className="sr-only">{labels[task.status]}</span>
                <p><RoadmapText>{task.description}</RoadmapText></p>
              </div>
            </li>)}
          </ul> : <p className="lapiz-empty"><RoadmapText>{labels.empty}</RoadmapText></p>}
        </section>
      })}
    </div>

    </>}

    <footer className="lapiz-footer"><RoadmapText>LAPIZ / ROADMAP</RoadmapText></footer>
  </main></RevealCharacters.Provider></RevealFrame.Provider>
}
