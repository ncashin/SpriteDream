import * as http from 'node:http'
import * as net from 'node:net'

import { createFetchProxy } from 'remix/fetch-proxy'
import { createHmrReadyFetch, run } from 'remix/node-hmr'
import { createRequestListener } from 'remix/node-fetch-server'

const hmrProxyPort = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 44100
const hmrEventPort = process.env.HMR_PORT
  ? Number.parseInt(process.env.HMR_PORT, 10)
  : hmrProxyPort + 1
const appPort = process.env.APP_PORT ? Number.parseInt(process.env.APP_PORT, 10) : hmrEventPort + 1

const hmrRunner = run('server.ts', {
  env: {
    ...process.env,
    PORT: String(appPort),
    HMR_PROXY_PORT: String(hmrProxyPort),
  },
  nodeArgs: ['--import', 'remix/node-tsx', '--import', 'remix/component-hmr/node'],
  browserHmrChannel: { port: hmrEventPort },
})

const server = http.createServer(
  createRequestListener(
    createHmrReadyFetch(
      hmrRunner,
      createFetchProxy(`http://127.0.0.1:${appPort}`, {
        xForwardedHeaders: true,
      }),
    ),
  ),
)

server.on('upgrade', (request, socket, head) => {
  const target = net.connect(appPort, '127.0.0.1', () => {
    const headers = Object.entries(request.headers)
      .flatMap(([name, value]) => (value == null ? [] : [`${name}: ${Array.isArray(value) ? value.join(', ') : value}`]))
      .join('\r\n')
    target.write(`${request.method} ${request.url} HTTP/1.1\r\n${headers}\r\n\r\n`)
    if (head.length > 0) target.write(head)
    target.pipe(socket)
    socket.pipe(target)
  })
  target.on('error', () => socket.destroy())
})

server.listen(hmrProxyPort, '127.0.0.1')

let shuttingDown = false

function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  server.close(() => hmrRunner.close().finally(() => process.exit(0)))
  server.closeAllConnections()
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
