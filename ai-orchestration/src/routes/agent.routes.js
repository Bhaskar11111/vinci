import { Router } from "express";
import agent from '../agents/code.agent.js'
const agentRouter=Router()

console.log('AGENT ROUTER LOADED')

agentRouter.post('/invoke', async (req, res) => {
    console.log('/invoke ROUTE HIT')
    let heartbeat

    try {
        const { message, projectId } = req.body
        if (!message?.trim() || !projectId) {
            return res.status(400).json({
                error: 'Both "message" and "projectId" are required'
            })
        }

        res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
        res.flushHeaders?.()
        // Keep the ingress and browser stream alive while slower tool calls
        // (notably npm install/build) are running without output.
        heartbeat = setInterval(() => {
            if (!res.writableEnded) res.write(': keep-alive\n\n')
        }, 10000)

        // The provider retries individual calls. Do not restart the whole
        // graph here: restarting repeats prior tools (especially list_files)
        // and loses the current coding trajectory.
        const mutationState = { updated: false }
        const runAgent = async (instruction) => {
            const stream = await agent.stream(
                { messages: [{ role: 'user', content: instruction }] },
                {
                    context: { projectId, mutationState },
                    streamMode: 'custom',
                    recursionLimit: 40
                }
            )

            for await (const chunk of stream) {
                console.log('CUSTOM STREAM:', chunk)
                res.write(`event: activity\ndata: ${JSON.stringify({ text: String(chunk) })}\n\n`)
            }
        }

        const isTransientProviderError = error => {
            const status = error?.status || error?.response?.status
            const detail = String(error?.message || error?.response?.data?.error || '').toLowerCase()
            return status === 429 || status === 503 || /high demand|temporar|overload|rate limit|resource exhausted/.test(detail)
        }
        const runWithRetry = async instruction => {
            let lastError
            for (let attempt = 0; attempt < 3; attempt += 1) {
                try { return await runAgent(instruction) }
                catch (error) {
                    lastError = error
                    // Retrying after writes can duplicate a mutation. Only repeat a
                    // pristine provider request, which is the failure mode here.
                    if (!isTransientProviderError(error) || mutationState.updated || attempt === 2) throw error
                    const seconds = 2 ** (attempt + 1)
                    res.write(`event: activity\ndata: ${JSON.stringify({ text: `Model capacity is busy. Retrying automatically in ${seconds}s…` })}\n\n`)
                    await new Promise(resolve => setTimeout(resolve, seconds * 1000))
                }
            }
            throw lastError
        }

        await runWithRetry(message)

        // Some providers can return a final text response directly after an
        // inspection tool. Give that exact run one focused continuation, not a
        // broad retry loop. This makes the mutation contract deterministic
        // while avoiding repeated calls that burn the user's quota.
        if (!mutationState.updated) {
            await runWithRetry(`Continue this coding task: "${message}". The previous pass only inspected the workspace and did not modify it. Do not call list_files again. Read the relevant existing files, then call update_files with the complete implementation now. Do not return a final answer until update_files succeeds.`)
        }

        if (!mutationState.updated) {
            throw new Error('The coding agent ended without updating any files. No false success was reported; please retry after checking the provider quota.')
        }

        res.write('event: complete\ndata: {}\n\n')

    } catch (err) {
        console.error('Error invoking agent:', err)
        if (res.headersSent) {
            const detail = err.response?.data?.message || err.response?.data?.error || err.message
            res.write(`event: error\ndata: ${JSON.stringify({ error: `Agent execution failed: ${detail}` })}\n\n`)
            return
        }
        res.status(500).json({ error: 'Failed to invoke agent' })
    } finally {
        if (heartbeat) clearInterval(heartbeat)
        if (res.headersSent && !res.writableEnded) res.end()
    }
})

export default agentRouter;
