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

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 16, y: 14 },
  })
  window.loadURL(url)
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => server.kill('SIGTERM'))
