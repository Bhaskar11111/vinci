import { response, Router } from "express";
import agent from '../agents/code.agent.js'
const agentRouter=Router()

console.log('AGENT ROUTER LOADED')

agentRouter.post('/invoke', async (req, res) => {
    console.log('/invoke ROUTE HIT')

    try {
        const { message, projectId } = req.body

        res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

        const stream = await agent.stream(
            {
                messages: [
                    {
                        role: 'user',
                        content: message
                    }
                ]
            },
            {
                context: {
                    projectId
                },
                streamMode: 'custom'
            }
        )

        for await (const chunk of stream) {
            console.log('CUSTOM STREAM:', chunk)
            res.write(`data: ${chunk}\n\n`)
        }

        res.json({
            status: 'success',
            // stream
        })

    } catch (err) {
        console.error('Error invoking agent:', err)

        res.status(500).json({
            error: 'Failed to invoke agent'
        })
    }
})

export default agentRouter;