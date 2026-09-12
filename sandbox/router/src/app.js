import express from 'express'
import {createProxyMiddleware} from 'http-proxy-middleware'
import morgan from 'morgan';

const app=express();
app.use(morgan('dev'))

app.get('/api/status/healthz',(req,res)=>
{
    res.status(200).json({status:'ok'})
})

app.get('/api/status/readyz',(req,res)=>
{
    res.status(200).json({status:'ready'})
})

const proxies={}

const getProxy=(sandboxId)=>
{
     const target = `http://sandbox-service-${sandboxId}`;

     if(!proxies[sandboxId])
     {
        proxies[sandboxId]=createProxyMiddleware({
            target,
            changeOrigin:true,
            ws:true
        })
    }
    return proxies[sandboxId];
}

app.use((req, res, next) => {
    const host = req.hostname;

    if (!host) {
        return res.status(400).json({
            error: 'Host header is missing'
        });
    }

    const sandboxId = host.split('.')[0];

   

    return getProxy(sandboxId)(req, res, next);
});
export default app;