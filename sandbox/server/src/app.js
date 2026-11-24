import express from 'express'
import morgan from 'morgan'
import { createPod } from './kubernetes/pod.js'
import { createService } from './kubernetes/service.js'
import { waitForSandboxReady } from './kubernetes/ready.js'
import {v7 as uuid} from 'uuid'

const app=express()

app.use((req,res,next) => {
    res.setHeader('Access-Control-Allow-Origin','*')
    res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers','Content-Type')
    if (req.method === 'OPTIONS') return res.sendStatus(204)
    next()
})
app.use(express.json())
app.use(morgan('dev'))
app.use(express.urlencoded({extended:true}))


//sandbox health api
app.get('/api/sandbox/health',(req,res)=>
{
    res.status(200).json({
        message:'Sandbox API is healthy',
        status:'ok'
    })
})


//sandbox create api
app.post('/api/sandbox/create',(async(req,res)=>
{
    const sandboxId=uuid();

    await Promise.all([
        createPod(sandboxId),
        createService(sandboxId)
    ])
    await waitForSandboxReady(sandboxId)

    return res.status(201).json({
        message:'Sandbox environment created successfully',
        sandboxId,
        previewURL:`http://${sandboxId}.preview.localhost`
    })
}))

export default app;
