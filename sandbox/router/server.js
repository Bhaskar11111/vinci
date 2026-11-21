import app, { proxyForHost } from "./src/app.js";

const server = app.listen(3000,()=>
{
    console.log('Sandbox router server running on port 3000')
})

server.on('upgrade', (req, socket, head) => {
    const host = req.headers.host?.split(':')[0]
    const proxy = host && proxyForHost(host)

    if (!proxy) {
        socket.destroy()
        return
    }

    proxy.upgrade(req, socket, head)
})
