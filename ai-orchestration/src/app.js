import express from 'express'
import morgan from 'morgan'
import dotenv from 'dotenv'
dotenv.config()

const app=express();

app.use(express.json())
app.use(express.urlencoded({extended:true}))
app.use(morgan('dev'))

app.get('/api/ai/healthz',((req,res)=>
{
    res.status(200).json({
        message:'AI API is healthy',
        status:'ok'
    })
}))

export default app;