import { Router } from "express";
import agent from '../agents/code.agent.js'
const agentRouter=Router()

console.log('AGENT ROUTER LOADED')

agentRouter.post('/invoke', async (req, res) => {
    console.log('/invoke ROUTE HIT')

    try {
        const { message, projectId } = req.body

        const response = await agent.invoke(
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
                }
            }
        )

        res.json({ response })

    } catch (err) {
        console.error('Error invoking agent:', err)

        res.status(500).json({
            error: 'Failed to invoke agent'
        })
    }
})

export default agentRouter;