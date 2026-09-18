import express from 'express'
import morgan from 'morgan'
import dotenv from 'dotenv'
import agentRouter from './routes/agent.routes.js'

dotenv.config()

const app = express()

//middleware
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(morgan('dev'))

app.get('/api/status/healthz', (req, res) => {
    res.status(200).json({
        message: 'AI API is healthy',
        status: 'ok'
    })
})

//routes
app.use('/api/ai', agentRouter)

export default app