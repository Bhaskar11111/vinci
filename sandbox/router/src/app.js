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

/*
 * pod1.preview.localhost
 * pod1.agent.localhost
 * 
 * {both URL handles by the same server}
 */ 

const proxies={}
const agentProxies={}

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
const getAgentProxy=(sandboxId)=>
{
     const target = `http://sandbox-service-${sandboxId}:3000`;

     if(!agentProxies[sandboxId])
     {
        agentProxies[sandboxId]=createProxyMiddleware({
            target,
            changeOrigin:true,
            ws:true
        })
    }
    return agentProxies[sandboxId];
}

export const proxyForHost = (host) => {
    const [sandboxId, subdomain] = host.split('.')

    if (!sandboxId) return null
    if (subdomain === 'agent') return getAgentProxy(sandboxId)
    if (subdomain === 'preview') return getProxy(sandboxId)

    return null
}

app.use((req, res, next) => {
    const host = req.hostname;

    if (!host) {
        return res.status(400).json({
            error: 'Host header is missing'
        });
    }

    const proxy = proxyForHost(host)
    if (proxy) return proxy(req, res, next)

    return res.status(404).json({ error: 'Unknown sandbox host' })
});
export default app;
