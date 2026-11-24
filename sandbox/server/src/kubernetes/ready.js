const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))

async function requestReady(url) {
    try {
        const response = await fetch(url, { signal: AbortSignal.timeout(2500) })
        return response.ok
    } catch {
        return false
    }
}

// A sandbox is useful only after both the coding sidecar and Vite preview are
// reachable through its service. Waiting here prevents the AI from calling a
// just-created service with no endpoints.
export async function waitForSandboxReady(sandboxId, timeoutMs = 120000) {
    const agentUrl = `http://sandbox-service-${sandboxId}:3000/healthz`
    const previewUrl = `http://sandbox-service-${sandboxId}/`
    const deadline = Date.now() + timeoutMs

    while (Date.now() < deadline) {
        const [agentReady, previewReady] = await Promise.all([
            requestReady(agentUrl),
            requestReady(previewUrl)
        ])
        if (agentReady && previewReady) return
        await delay(2000)
    }

    throw new Error('Sandbox did not become ready within 120 seconds')
}
