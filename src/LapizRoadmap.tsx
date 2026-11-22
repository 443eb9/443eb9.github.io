import { useState } from 'react'
import { Contours } from './Fields'
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

export function LapizRoadmap() {
  const [filter, setFilter] = useState<(typeof filters)[number]['id']>('all')

  return <main className="lapiz-roadmap scene">
    <LapizBackdrop />
    <header className="lapiz-header">
      <span><i aria-hidden="true" /> LAPIZ / ROADMAP</span>
      <a href="/"><span aria-hidden="true">← </span>返回群岛</a>
    </header>

    <div className="lapiz-hero">
      <h1><span lang="en">Lapiz</span> <span className="lapiz-subtitle">开发路线图</span></h1>
    </div>

    <div className="lapiz-toolbar">
      <div className="lapiz-filters" role="group" aria-label="按任务状态筛选">
        {filters.map(({ id, label, count }) => <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}>
          {id !== 'all' && <span className="lapiz-status" data-status={id} aria-hidden="true" />}
          {label}<span className="lapiz-filter-count">{count}</span>
        </button>)}
      </div>
      <p className="lapiz-result" role="status">显示 {filters.find(item => item.id === filter)?.count} / {tasks.length} 项</p>
    </div>

    <div className="lapiz-stages">
      {roadmap.map((stage, index) => {
        const id = `lapiz-stage-${index + 1}`
        const visible = filter === 'all' ? stage.tasks : stage.tasks.filter(task => task.status === filter)

        return <section key={stage.version} className="lapiz-stage" aria-labelledby={id}>
          <header className="lapiz-stage-header">
            <p className="lapiz-stage-index"><span>阶段 {String(index + 1).padStart(2, '0')}</span><span>{visible.length} 项</span></p>
            <h2 id={id}>{stage.version}</h2>
            {stage.codename && <p className="lapiz-codename" lang="en">{stage.codename}</p>}
            <p className="lapiz-stage-description">{stage.description}</p>
          </header>
          {visible.length ? <ul className="lapiz-tasks" role="list">
            {visible.map(task => <li key={task.title} className="lapiz-task" data-status={task.status}>
              <span className="lapiz-status" data-status={task.status} aria-hidden="true" />
              {[0, 1, 2, 3].map(corner => <i key={corner} className={`tag-corner tag-corner-${corner}`} aria-hidden="true" />)}
              <div>
                <h3>{task.title}</h3>
                <span className="sr-only">{statuses.find(status => status.id === task.status)?.label}</span>
                <p>{task.description}</p>
              </div>
            </li>)}
          </ul> : <p className="lapiz-empty">这个阶段没有符合条件的任务</p>}
        </section>
      })}
    </div>

    <footer className="lapiz-footer"><span>LAPIZ / ROADMAP</span></footer>
  </main>
}
