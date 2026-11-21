import { useEffect, useMemo, useRef, useState } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''
const EXAMPLES = ['Create a portfolio site for a motion designer', 'Build an inventory dashboard for a small studio', 'Make a landing page for a climate-tech startup']

const Icon = ({ children }) => <span className="icon" aria-hidden="true">{children}</span>

function App() {
  const [view, setView] = useState('create')
  const [prompt, setPrompt] = useState('')
  const [project, setProject] = useState(null)
  const [events, setEvents] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [filesOpen, setFilesOpen] = useState(false)
  const [activityOpen, setActivityOpen] = useState(true)
  const composer = useRef(null)

  useEffect(() => {
    const saved = localStorage.getItem('vinci:last-project')
    if (saved) setProject(JSON.parse(saved))
  }, [])

  const status = useMemo(() => {
    if (error) return { label: 'Needs attention', tone: 'error' }
    if (busy) return { label: 'Building', tone: 'active' }
    if (project) return { label: 'Ready', tone: 'ready' }
    return { label: 'Idle', tone: 'muted' }
  }, [busy, error, project])

  const generate = async () => {
    const request = prompt.trim()
    if (!request || busy) return
    setBusy(true); setError(null); setEvents([]); setView('workspace')
    try {
      setEvents([{ label: 'Creating an isolated project environment', time: Date.now() }])
      const sandbox = await fetch(`${API_BASE}/api/sandbox/create`, { method: 'POST', headers: { 'Content-Type': 'application/json' } })
      if (!sandbox.ok) throw new Error(`Sandbox creation failed (${sandbox.status})`)
      const created = await sandbox.json()
      const nextProject = { id: created.sandboxId, url: created.previewURL, prompt: request, createdAt: new Date().toISOString() }
      setProject(nextProject); localStorage.setItem('vinci:last-project', JSON.stringify(nextProject))
      setEvents(current => [...current, { label: 'Sandbox ready — delegating to Vinci agent', time: Date.now() }])

      const response = await fetch(`${API_BASE}/api/ai/invoke`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: request, projectId: created.sandboxId }) })
      if (!response.ok || !response.body) throw new Error(`Agent request failed (${response.status})`)
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ''
      while (true) {
        const { done, value } = await reader.read(); if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n'); buffer = parts.pop() ?? ''
        parts.forEach(part => {
          const data = part.split('\n').find(line => line.startsWith('data: '))?.slice(6)?.trim()
          if (data) setEvents(current => [...current, { label: data, time: Date.now() }])
        })
      }
      setEvents(current => [...current, { label: 'Agent stream completed', time: Date.now() }])
    } catch (err) {
      setError(err.message); setEvents(current => [...current, { label: err.message, time: Date.now(), failed: true }])
    } finally { setBusy(false) }
  }

  return <div className="app-shell">
    <aside className="rail" aria-label="Primary navigation">
      <button className="mark" onClick={() => setView('create')} aria-label="Vinci home">V</button>
      <nav>
        <button className={view === 'dashboard' ? 'nav active' : 'nav'} onClick={() => setView('dashboard')}><Icon>◫</Icon><span>Overview</span></button>
        <button className={view === 'create' ? 'nav active' : 'nav'} onClick={() => { setView('create'); setTimeout(() => composer.current?.focus(), 0) }}><Icon>＋</Icon><span>Create</span></button>
        <button className={view === 'workspace' ? 'nav active' : 'nav'} disabled={!project} onClick={() => setView('workspace')}><Icon>⌘</Icon><span>Workspace</span></button>
      </nav>
      <div className="rail-bottom"><button className="avatar" aria-label="Account">BM</button></div>
    </aside>
    <main>
      <header className="topbar"><div><span className="eyebrow">VINCI / {view}</span><h1>{view === 'create' ? 'What will you build?' : view === 'workspace' ? 'Project workspace' : 'Your work'}</h1></div><div className={`status ${status.tone}`}><i />{status.label}</div></header>
      {view === 'dashboard' && <Dashboard project={project} open={() => setView(project ? 'workspace' : 'create')} />}
      {view === 'create' && <section className="creation"><div className="creation-copy"><p className="display">From intent<br />to <em>interface.</em></p><p>Describe the product. Vinci creates an isolated workspace, delegates implementation to the agent, and validates the running build.</p></div><div className="composer"><label htmlFor="prompt">Describe the application</label><textarea ref={composer} id="prompt" value={prompt} onChange={e => setPrompt(e.target.value)} onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') generate() }} placeholder="A calm, elegant workspace for a design studio to manage client projects…" /><div className="composer-footer"><span className="key">⌘ ↵ to generate</span><button className="generate" disabled={!prompt.trim() || busy} onClick={generate}>{busy ? 'Generating…' : 'Generate'} <span>→</span></button></div></div><div className="examples">{EXAMPLES.map(example => <button key={example} onClick={() => { setPrompt(example); composer.current?.focus() }}>{example}<span>↗</span></button>)}</div></section>}
      {view === 'workspace' && <Workspace project={project} events={events} error={error} busy={busy} filesOpen={filesOpen} setFilesOpen={setFilesOpen} activityOpen={activityOpen} setActivityOpen={setActivityOpen} />}
    </main>
  </div>
}

function Dashboard({ project, open }) { return <section className="dashboard"><div className="continue"><div><span className="eyebrow">CONTINUE BUILDING</span><h2>{project ? project.prompt : 'Begin your first build'}</h2><p>{project ? `Workspace ${project.id.slice(0, 8)} is ready for another iteration.` : 'Start with a natural-language brief. Vinci will create the environment and stream the real build activity.'}</p><button className="generate" onClick={open}>{project ? 'Open workspace' : 'Create project'} <span>→</span></button></div><div className="signal"><b>01</b><span>Agent-powered<br />application engine</span></div></div><div className="section-title"><h3>Projects</h3><span>{project ? '1 in this browser' : 'No projects yet'}</span></div>{project ? <button className="project-row" onClick={open}><div className="project-art"><span>V</span></div><div><strong>{project.prompt}</strong><small>{new Date(project.createdAt).toLocaleString()}</small></div><div className="ready"><i />Ready</div><span>→</span></button> : <div className="empty">No server-side project history is available yet. Your first real project will appear here for this browser session.</div>}</section> }

function Workspace({ project, events, error, busy, filesOpen, setFilesOpen, activityOpen, setActivityOpen }) { if (!project) return <section className="empty">No active project. <button onClick={() => location.reload()}>Create one</button></section>; return <section className="workspace"><div className="workspace-toolbar"><div><span className="eyebrow">LIVE PREVIEW</span><strong>{project.id}</strong></div><div><button onClick={() => setFilesOpen(!filesOpen)}>Files</button><button onClick={() => setActivityOpen(!activityOpen)}>Activity</button><a className="open" href={project.url} target="_blank" rel="noreferrer">Open ↗</a></div></div><div className={`workspace-grid ${filesOpen ? 'files' : ''} ${activityOpen ? 'activity' : ''}`}>{filesOpen && <aside className="panel files-panel"><span className="eyebrow">FILES</span><p>File inspection becomes available through the project agent endpoint.</p></aside>}<div className="preview"><iframe title="Generated project preview" src={project.url} /><div className="preview-fallback"><span>Preview loads in its isolated origin.</span><a href={project.url} target="_blank" rel="noreferrer">Open preview ↗</a></div></div>{activityOpen && <aside className="panel activity-panel"><span className="eyebrow">ACTIVITY</span>{events.length ? <ol>{events.map((event, index) => <li className={event.failed ? 'failed' : ''} key={`${event.time}-${index}`}><i />{event.label}</li>)}</ol> : <p>{busy ? 'Connecting to agent…' : 'No activity yet.'}</p>}{error && <details open><summary>Technical details</summary><pre>{error}</pre></details>}</aside>}</div></section> }

export default App
