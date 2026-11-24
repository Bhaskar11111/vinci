// In development, use the local ingress directly. This avoids coupling the
// task lifecycle to Vite's proxy process and still keeps production same-origin.
const apiBase = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? 'http://localhost' : '')

async function request(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })
  if (!response.ok) {
    let detail = ''
    try { detail = (await response.json()).error ?? '' } catch {}
    throw new Error(detail || `Request failed (${response.status})`)
  }
  return response
}

export async function createSandbox() {
  const response = await request('/api/sandbox/create', { method: 'POST' })
  return response.json()
}

export async function streamAgent({ message, projectId, signal, onEvent }) {
  const response = await request('/api/ai/invoke', {
    method: 'POST',
    body: JSON.stringify({ message, projectId }),
    signal,
  })
  if (!response.body) throw new Error('Agent response did not include a stream')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const frames = buffer.split('\n\n')
    buffer = frames.pop() ?? ''
    for (const frame of frames) {
      const type = frame.split('\n').find(line => line.startsWith('event: '))?.slice(7) ?? 'activity'
      const payload = frame.split('\n').find(line => line.startsWith('data: '))?.slice(6)
      if (!payload) continue
      let data
      try { data = JSON.parse(payload) }
      catch { data = { text: payload } }
      onEvent(type, data)
    }
  }
}
