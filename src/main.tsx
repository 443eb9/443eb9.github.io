import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MotionConfig } from 'motion/react'
import { Home } from './Home'
import { Log } from './Log'
import './styles.css'

const path = window.location.pathname.replace(/\/$/, '') || '/'

createRoot(document.getElementById('root')!).render(
  <StrictMode><MotionConfig reducedMotion="user">
    {path === '/' ? <Home /> : path === '/log' ? <Log /> : <main className="missing"><h1>404 · 这片海域等待探索</h1><a className="frame-button" href="/">返回群岛</a></main>}
  </MotionConfig></StrictMode>,
)
