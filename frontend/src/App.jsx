import { useEffect, useRef, useState } from 'react'
import { createSandbox, streamAgent } from './api'

const starter = ['Build a portfolio for a graphic designer', 'Create an inventory dashboard for a small shop', 'Make a landing page for a new developer tool']
const Icon = ({ children }) => <span className="icon" aria-hidden="true">{children}</span>
const time = value => new Intl.DateTimeFormat([], { hour: '2-digit', minute: '2-digit' }).format(value)
const duration = totalSeconds => {
  const seconds = Math.max(0, totalSeconds)
  if (seconds < 60) return `${seconds} second${seconds === 1 ? '' : 's'}`
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${minutes} min${minutes === 1 ? '' : 's'} ${remainder} second${remainder === 1 ? '' : 's'}`
}
function activityKind(text) {
  const value = text.toLowerCase()
  if (value.includes('error') || value.includes('failed')) return 'failure'
  if (value.includes('success') || value.includes('updated successfully') || value.includes('installed successfully')) return 'success'
  if (value.includes('updating') || value.includes('installing')) return 'write'
  return 'read'
}
function activityUpdate(text, now) {
  const clean = text.trim()
  const listing = clean.match(/^Files listed successfully\.\s*Files:\s*(.*)$/is)
  if (listing) return { id: 'list-files', label: 'Listed project files', status: 'success', files: listing[1].split(',').map(file => file.trim()).filter(Boolean), time: now }
  if (/^Listing files in project directory/i.test(clean)) return { id: 'list-files', label: 'Listing files in project directory…', status: 'working', time: now }
  if (/^Reading files/i.test(clean)) return { id: 'read-files', label: clean.replace(/\s+/g, ' '), status: 'working', time: now }
  if (/^Files read successfully/i.test(clean)) return { id: 'read-files', label: 'Read project files', status: 'success', time: now }
  if (/^Installing dependencies/i.test(clean)) return { id: 'install-dependencies', label: 'Installing dependencies…', status: 'working', time: now }
  if (/^Dependencies installed successfully/i.test(clean)) return { id: 'install-dependencies', label: 'Installed dependencies', status: 'success', time: now }
  if (/^Updating files/i.test(clean)) return { id: 'update-files', label: clean.replace(/\s+/g, ' '), status: 'working', time: now }
  if (/^Files updated successfully/i.test(clean)) return { id: 'update-files', label: 'Updated project files', status: 'success', time: now }
  return { id: `event-${clean}`, label: clean, status: activityKind(clean), time: now }
}
function mergeActivity(items, text) {
  const next = activityUpdate(text, Date.now())
  const index = items.findIndex(item => item.role === 'activity' && item.id === next.id)
  if (index < 0) return [...items, { role: 'activity', ...next }]
  const copy = [...items]
  copy[index] = { ...copy[index], ...next, time: Date.now() }
  return copy
}
function ActivityRow({ event }) {
  const [filesOpen, setFilesOpen] = useState(false)
  const kind = event.status || activityKind(event.text || event.label)
  return <div className={`activity-row ${kind}`}><span className="activity-mark" /><div><div className="activity-content"><p>{event.label || event.text}</p>{event.files?.length ? <button className="files-toggle" onClick={() => setFilesOpen(open => !open)}>See {event.files.length} files <span>{filesOpen ? '⌃' : '⌄'}</span></button> : null}</div><time>{time(event.time)}</time></div>{filesOpen && <ul className="file-list">{event.files.map(file => <li key={file}>{file}</li>)}</ul>}</div>
}

export default function App() {
  const [prompt, setPrompt] = useState('')
  const [project, setProject] = useState(null)
  const [events, setEvents] = useState([])
  const [busy, setBusy] = useState(false)
  const [panel, setPanel] = useState('activity')
  const [panelOpen, setPanelOpen] = useState(true)
  const [panelWidth, setPanelWidth] = useState(() => Number(localStorage.getItem('vinci:context-width')) || 332)
  const [navOpen, setNavOpen] = useState(false)
  const [error, setError] = useState(null)
  const [runStartedAt, setRunStartedAt] = useState(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [completedSeconds, setCompletedSeconds] = useState(null)
  const composerRef = useRef()
  const scrollRef = useRef()

  useEffect(() => {
    const saved = localStorage.getItem('vinci:last-project')
    if (saved) { try { setProject(JSON.parse(saved)) } catch { localStorage.removeItem('vinci:last-project') } }
  }, [])
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }) }, [events, busy])
  useEffect(() => {
    if (!busy || !runStartedAt) return undefined
    const updateElapsed = () => setElapsedSeconds(Math.floor((Date.now() - runStartedAt) / 1000))
    updateElapsed()
    const interval = window.setInterval(updateElapsed, 1000)
    return () => window.clearInterval(interval)
  }, [busy, runStartedAt])

  function beginPanelResize(event) {
    if (window.innerWidth <= 850) return
    event.preventDefault()
    const initialX = event.clientX
    const initialWidth = panelWidth
    const resize = moveEvent => {
      const nextWidth = Math.min(620, Math.max(280, initialWidth + initialX - moveEvent.clientX))
      setPanelWidth(nextWidth)
    }
    const stop = () => {
      window.removeEventListener('pointermove', resize)
      window.removeEventListener('pointerup', stop)
      setPanelWidth(width => {
        localStorage.setItem('vinci:context-width', String(width))
        return width
      })
    }
    window.addEventListener('pointermove', resize)
    window.addEventListener('pointerup', stop)
  }

  async function send() {
    const message = prompt.trim()
    if (!message || busy) return
    setBusy(true); setError(null)
    const startedAt = Date.now()
    setRunStartedAt(startedAt); setElapsedSeconds(0); setCompletedSeconds(null)
    setEvents(items => [...items, { role: 'user', text: message, time: Date.now() }])
    setPrompt(''); setPanel('activity'); setPanelOpen(true)
    try {
      const result = await createSandbox()
      const nextProject = { id: result.sandboxId, url: result.previewURL, prompt: message, createdAt: new Date().toISOString() }
      setProject(nextProject); localStorage.setItem('vinci:last-project', JSON.stringify(nextProject))
      await streamAgent({
        message,
        projectId: result.sandboxId,
        onEvent(type, payload) {
          if (type === 'error') throw Error(payload.error || 'Agent execution failed')
          if (type === 'activity' && payload.text) {
            setEvents(items => mergeActivity(items, payload.text))
          }
        },
      })
    } catch (caught) {
      setError(caught.message)
      setEvents(items => [...items, { role: 'error', text: caught.message, time: Date.now() }])
    } finally {
      setCompletedSeconds(Math.floor((Date.now() - startedAt) / 1000))
      setBusy(false)
    }
  }
  const chooseStarter = value => { setPrompt(value); composerRef.current?.focus() }
  const projectName = project?.prompt || 'Untitled workspace'
  const activityEvents = events.filter(event => event.role === 'activity')

  return <div className={`shell ${panelOpen ? '' : 'panel-closed'}`} style={{ '--context-width': `${panelWidth}px` }}>
    <aside className={`sidebar ${navOpen ? 'mobile-open' : ''}`}>
      <div className="sidebar-top"><button className="wordmark" onClick={() => composerRef.current?.focus()}><span>V</span>VINCI</button><button className="new-task" onClick={() => composerRef.current?.focus()}><Icon>＋</Icon> New task <kbd>⌘ N</kbd></button></div>
      <button className="search"><Icon>⌕</Icon><span>Search</span><kbd>⌘ K</kbd></button>
      <nav><p className="nav-label">WORKSPACE</p><button className="nav-item active"><Icon>⌘</Icon>Vinci</button><button className="nav-item"><Icon>▦</Icon>Projects</button><button className="nav-item"><Icon>◌</Icon>Activity</button></nav>
      <section className="recent"><p className="nav-label">RECENT</p>{project ? <button className="recent-item" onClick={() => { setPanel('preview'); setPanelOpen(true) }}><span className="recent-dot" />{projectName}</button> : <p className="empty-recent">No recent tasks</p>}</section>
      <div className="account-wrap"><button className="account"><span className="initials">BM</span><span>Bhaskar Mishra<small>Personal workspace</small></span><Icon>···</Icon></button></div>
    </aside>
    <main className="workspace">
      <header className="workspace-bar"><button className="mobile-menu" onClick={() => setNavOpen(!navOpen)}>☰</button><div><strong>{events.length ? projectName : 'New task'}</strong><span>{events.length ? 'Engineering workspace' : 'Vinci application agent'}</span></div><div className="bar-actions"><button onClick={() => { setPanelOpen(!panelOpen); setNavOpen(false) }}><Icon>▱</Icon></button><button><Icon>···</Icon></button></div></header>
      <section className="conversation" ref={scrollRef}>
        {!events.length ? <div className="empty-workspace"><div className="eyebrow"><span />READY TO BUILD</div><h1>Start with an idea.</h1><p>Describe what you want to make. Vinci will create an isolated workspace and turn it into a working application.</p><div className="suggestions">{starter.map(item => <button key={item} onClick={() => chooseStarter(item)}>{item}<Icon>↗</Icon></button>)}</div></div> : <div className="transcript">{events.map((event, index) => event.role === 'user' ? <article className="user-message" key={`${event.time}-${index}`}><div><span className="message-meta">YOU <time>{time(event.time)}</time></span><p>{event.text}</p></div></article> : event.role === 'error' ? <article className="error-message" key={`${event.time}-${index}`}><span>Build interrupted</span><p>{event.text}</p></article> : <ActivityRow event={event} key={`${event.time}-${index}`} />)}{busy && <div className="working"><span className="pulse" />Working for {duration(elapsedSeconds)}<em>streaming live activity</em></div>}{!busy && completedSeconds !== null && <div className="worked-for"><span>✓</span> Worked for {duration(completedSeconds)} <em>{error ? 'task interrupted' : 'task complete'}</em></div>}</div>}
      </section>
      <div className="composer-area"><div className="composer"><textarea ref={composerRef} value={prompt} onChange={event => setPrompt(event.target.value)} onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') send() }} placeholder="Describe what you want to build…" rows="3" /><footer><div><button className="attach"><Icon>＋</Icon></button><span>{project ? 'Workspace context attached' : 'New isolated workspace'}</span></div><div><kbd>⌘ ↵</kbd><button className="send" disabled={!prompt.trim() || busy} onClick={send}>↑</button></div></footer></div></div>
    </main>
    <aside className="context-panel">
      <div className="panel-resizer" onPointerDown={beginPanelResize} role="separator" aria-label="Resize context panel" aria-orientation="vertical" />
      <header><div className="panel-tabs"><button className={panel === 'activity' ? 'selected' : ''} onClick={() => setPanel('activity')}>Activity</button><button className={panel === 'preview' ? 'selected' : ''} onClick={() => setPanel('preview')}>Preview</button></div><button className="close-panel" onClick={() => setPanelOpen(false)}>×</button></header>
      {panel === 'preview' && project ? <div className="preview"><div className="preview-toolbar"><span><i /> localhost</span><a href={project.url} target="_blank" rel="noreferrer">Open ↗</a></div><iframe title="Live project preview" src={project.url} /></div> : <div className="activity-panel">{project ? <><div className="project-state"><span className={busy ? 'state-building' : 'state-ready'}>{busy ? `WORKING FOR ${duration(elapsedSeconds)}` : 'WORKSPACE READY'}</span><h2>{projectName}</h2><p className="project-id">{project.id}</p>{!busy && completedSeconds !== null && <p className="project-duration">Worked for {duration(completedSeconds)}</p>}</div><div className="activity-heading"><span>LIVE EXECUTION</span><small>{activityEvents.length} events</small></div><div className="activity-list">{activityEvents.length ? activityEvents.map((event, index) => <ActivityRow event={event} key={`${event.time}-side-${index}`} />) : <p className="waiting">Waiting for agent activity…</p>}</div>{error && <details open><summary>Technical details</summary><pre>{error}</pre></details>}</> : <div className="panel-empty"><div className="panel-grid">⌘</div><h2>Project context</h2><p>Activity, build details, and a live preview will appear here when you start a task.</p></div>}</div>}
    </aside>
  </div>
}
