import { useEffect, useRef, useState } from 'react'

const api = import.meta.env.VITE_API_BASE_URL ?? ''
const starter = ['Build a portfolio for a graphic designer', 'Create an inventory dashboard for a small shop', 'Make a landing page for a new developer tool']
const Icon = ({ children }) => <span className="icon" aria-hidden="true">{children}</span>
const time = value => new Intl.DateTimeFormat([], { hour: '2-digit', minute: '2-digit' }).format(value)
function activityKind(text) {
  const value = text.toLowerCase()
  if (value.includes('error') || value.includes('failed')) return 'failure'
  if (value.includes('success') || value.includes('updated successfully') || value.includes('installed successfully')) return 'success'
  if (value.includes('updating') || value.includes('installing')) return 'write'
  return 'read'
}
function ActivityRow({ event }) {
  const kind = activityKind(event.text)
  return <div className={`activity-row ${kind}`}><span className="activity-mark" /><div><p>{event.text}</p><time>{time(event.time)}</time></div></div>
}

export default function App() {
  const [prompt, setPrompt] = useState('')
  const [project, setProject] = useState(null)
  const [events, setEvents] = useState([])
  const [busy, setBusy] = useState(false)
  const [panel, setPanel] = useState('activity')
  const [panelOpen, setPanelOpen] = useState(true)
  const [navOpen, setNavOpen] = useState(false)
  const [error, setError] = useState(null)
  const composerRef = useRef()
  const scrollRef = useRef()

  useEffect(() => {
    const saved = localStorage.getItem('vinci:last-project')
    if (saved) { try { setProject(JSON.parse(saved)) } catch { localStorage.removeItem('vinci:last-project') } }
  }, [])
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }) }, [events, busy])

  async function send() {
    const message = prompt.trim()
    if (!message || busy) return
    setBusy(true); setError(null)
    setEvents(items => [...items, { role: 'user', text: message, time: Date.now() }])
    setPrompt(''); setPanel('activity'); setPanelOpen(true)
    try {
      const sandbox = await fetch(`${api}/api/sandbox/create`, { method: 'POST', headers: { 'Content-Type': 'application/json' } })
      if (!sandbox.ok) throw Error(`Sandbox creation failed (${sandbox.status})`)
      const result = await sandbox.json()
      const nextProject = { id: result.sandboxId, url: result.previewURL, prompt: message, createdAt: new Date().toISOString() }
      setProject(nextProject); localStorage.setItem('vinci:last-project', JSON.stringify(nextProject))
      const response = await fetch(`${api}/api/ai/invoke`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message, projectId: result.sandboxId }) })
      if (!response.ok || !response.body) throw Error(`Agent request failed (${response.status})`)
      const reader = response.body.getReader(), decoder = new TextDecoder(); let buffer = ''
      while (true) {
        const { done, value } = await reader.read(); if (done) break
        buffer += decoder.decode(value, { stream: true })
        const blocks = buffer.split('\n\n'); buffer = blocks.pop() ?? ''
        blocks.forEach(block => {
          const data = block.split('\n').find(line => line.startsWith('data: '))?.slice(6)?.trim()
          if (data) setEvents(items => [...items, { role: 'activity', text: data, time: Date.now() }])
        })
      }
    } catch (caught) {
      setError(caught.message)
      setEvents(items => [...items, { role: 'error', text: caught.message, time: Date.now() }])
    } finally { setBusy(false) }
  }
  const chooseStarter = value => { setPrompt(value); composerRef.current?.focus() }
  const projectName = project?.prompt || 'Untitled workspace'
  const activityEvents = events.filter(event => event.role === 'activity')

  return <div className={`shell ${panelOpen ? '' : 'panel-closed'}`}>
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
        {!events.length ? <div className="empty-workspace"><div className="eyebrow"><span />READY TO BUILD</div><h1>Start with an idea.</h1><p>Describe what you want to make. Vinci will create an isolated workspace and turn it into a working application.</p><div className="suggestions">{starter.map(item => <button key={item} onClick={() => chooseStarter(item)}>{item}<Icon>↗</Icon></button>)}</div></div> : <div className="transcript">{events.map((event, index) => event.role === 'user' ? <article className="user-message" key={`${event.time}-${index}`}><div><span className="message-meta">YOU <time>{time(event.time)}</time></span><p>{event.text}</p></div></article> : event.role === 'error' ? <article className="error-message" key={`${event.time}-${index}`}><span>Build interrupted</span><p>{event.text}</p></article> : <ActivityRow event={event} key={`${event.time}-${index}`} />)}{busy && <div className="working"><span className="pulse" /> Agent is working <em>streaming live activity</em></div>}</div>}
      </section>
      <div className="composer-area"><div className="composer"><textarea ref={composerRef} value={prompt} onChange={event => setPrompt(event.target.value)} onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') send() }} placeholder="Describe what you want to build…" rows="3" /><footer><div><button className="attach"><Icon>＋</Icon></button><span>{project ? 'Workspace context attached' : 'New isolated workspace'}</span></div><div><kbd>⌘ ↵</kbd><button className="send" disabled={!prompt.trim() || busy} onClick={send}>↑</button></div></footer></div></div>
    </main>
    <aside className="context-panel">
      <header><div className="panel-tabs"><button className={panel === 'activity' ? 'selected' : ''} onClick={() => setPanel('activity')}>Activity</button><button className={panel === 'preview' ? 'selected' : ''} onClick={() => setPanel('preview')}>Preview</button></div><button className="close-panel" onClick={() => setPanelOpen(false)}>×</button></header>
      {panel === 'preview' && project ? <div className="preview"><div className="preview-toolbar"><span><i /> localhost</span><a href={project.url} target="_blank" rel="noreferrer">Open ↗</a></div><iframe title="Live project preview" src={project.url} /></div> : <div className="activity-panel">{project ? <><div className="project-state"><span className={busy ? 'state-building' : 'state-ready'}>{busy ? 'BUILDING' : 'WORKSPACE READY'}</span><h2>{projectName}</h2><p className="project-id">{project.id}</p></div><div className="activity-heading"><span>LIVE EXECUTION</span><small>{activityEvents.length} events</small></div><div className="activity-list">{activityEvents.length ? activityEvents.map((event, index) => <ActivityRow event={event} key={`${event.time}-side-${index}`} />) : <p className="waiting">Waiting for agent activity…</p>}</div>{error && <details open><summary>Technical details</summary><pre>{error}</pre></details>}</> : <div className="panel-empty"><div className="panel-grid">⌘</div><h2>Project context</h2><p>Activity, build details, and a live preview will appear here when you start a task.</p></div>}</div>}
    </aside>
  </div>
}
