import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { realpathSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { listProjectFiles, readProjectFile, writeProjectFile } from './project-files.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const port = process.env.ELECTRON_PORT ?? '44200'
const url = `http://127.0.0.1:${port}/`

// Electron and the system Node (here v26) ship different V8 serializer versions.
// `serialization: 'advanced'` is required for Uint8Array file bodies, so the
// server has to run on Electron's Node or the IPC channel dies on the first message.
const server = spawn(process.execPath, ['--import', 'remix/node-tsx', 'server.ts'], {
  cwd: root,
  env: { ...process.env, PORT: port, ELECTRON_RUN_AS_NODE: '1' },
  stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
  serialization: 'advanced',
})

server.on('message', (message) => {
  if (message?.type === 'list-files') {
    server.send({ type: 'list-files', files: listProjectFiles(message.project) })
    return
  }

  if (message?.type === 'read-file') {
    server.send({
      type: 'read-file',
      body: readProjectFile(message.project, message.filePath),
    })
    return
  }

  if (message?.type === 'write-file') {
    server.send({
      type: 'write-file',
      ok: writeProjectFile(message.project, message.filePath, message.body),
    })
  }
})

ipcMain.handle('open-folder', async (event) => {
  const parent = BrowserWindow.fromWebContents(event.sender)
  const options = { properties: ['openDirectory'] }
  const result = parent
    ? await dialog.showOpenDialog(parent, options)
    : await dialog.showOpenDialog(options)
  const selected = result.filePaths[0]
  if (result.canceled || !selected) return null

  return realpathSync(selected)
})

function waitForServer() {
  return new Promise((resolve) => {
    const attempt = () => {
      fetch(url)
        .then((response) => {
          if (response.ok) resolve()
          else setTimeout(attempt, 100)
        })
        .catch(() => setTimeout(attempt, 100))
    }
    attempt()
  })
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: '#121213',
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 16, y: 14 },
    webPreferences: {
      preload: resolve(root, 'electron/preload.cjs'),
      contextIsolation: true,
      sandbox: false,
    },
  })
  window.webContents.on('did-fail-load', () => {
    setTimeout(() => window.loadURL(url), 150)
  })
  window.loadURL(url)
}

app.whenReady().then(async () => {
  await waitForServer()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => server.kill('SIGTERM'))
