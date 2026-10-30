import { app, BrowserWindow } from 'electron'
import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const port = process.env.ELECTRON_PORT ?? '44200'
const url = `http://127.0.0.1:${port}`

const server = spawn('node', ['--import', 'remix/node-tsx', 'server.ts'], {
  cwd: root,
  env: { ...process.env, PORT: port },
  stdio: 'inherit',
})

app.on('before-quit', () => server.kill('SIGTERM'))
app.on('window-all-closed', () => app.quit())

await app.whenReady()
while (true) {
  try {
    await fetch(url)
    break
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
}

new BrowserWindow({ width: 1280, height: 800 }).loadURL(url)
