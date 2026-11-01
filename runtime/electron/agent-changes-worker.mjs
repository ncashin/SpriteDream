import { parentPort } from 'node:worker_threads'

import { agentEditCount } from './agent-changes.mjs'

parentPort.on('message', async (message) => {
  try {
    parentPort.postMessage({ id: message.id, count: await agentEditCount(message.directory) })
  } catch {
    parentPort.postMessage({ id: message.id, count: 0 })
  }
})
