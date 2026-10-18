import type * as http from 'node:http'
import { randomUUID } from 'node:crypto'
import { any, array, boolean, defaulted, enum_, literal, number, object, optional, parseSafe, record, string, union } from 'remix/data-schema'
import { WebSocketServer, type WebSocket } from 'ws'

import { readSceneFile } from './scene-file.ts'
import { applyScenePatch, diffScene, type SceneNode, type ScenePath } from './utilities/scene.ts'
import type { WorldPoint } from './utilities/viewport/viewport.ts'

const roomMessage = union([
  object({
    type: defaulted(literal('scenePatch'), 'scenePatch'),
    scene: array(object({ path: array(string()), value: optional(any()) })),
  }),
  object({
    type: defaulted(literal('modeChange'), 'modeChange'),
    mode: enum_(['edit', 'play']),
    claim: optional(boolean()),
  }),
  object({
    type: defaulted(literal('cursorUpdate'), 'cursorUpdate'),
    cursor: object({ x: number(), y: number() }),
  }),
  object({
    type: defaulted(literal('selectionUpdate'), 'selectionUpdate'),
    selectedObjects: array(array(string())),
  }),
  object({
    type: defaulted(literal('inputUpdate'), 'inputUpdate'),
    input: record(string(), union([number(), boolean()])),
  }),
])

type Person = {
  id: string
  socket: WebSocket
  cursor?: WorldPoint
  selectedObjects: ScenePath[]
  input: Record<string, number | boolean>
  quiet: boolean
}

export type RoomState = {
  mode: 'edit' | 'play'
  host: string
  dirty: boolean
  people: Record<string, Person>
}

const sockets = new WebSocketServer({ noServer: true })
const roomState: RoomState = { mode: 'edit', host: '', dirty: false, people: {} }
const roomScene: SceneNode = {}
let savedScene = "{}"
let exampleScene: SceneNode = {}

export function noteSceneSaved(value: SceneNode) {
  savedScene = JSON.stringify(value)
  setDirty(roomState.mode === 'play' ? false : JSON.stringify(roomScene) !== savedScene)
}

setInterval(() => {
  for (const person of Object.values(roomState.people)) {
    if (person.quiet) {
      person.socket.terminate()
      leave(person.socket)
      continue
    }
    person.quiet = true
    person.socket.ping()
  }
}, 15000)

export async function attachRoom(server: http.Server) {
  exampleScene = (await readSceneFile("Example Scene")) ?? {}
  Object.assign(roomScene, exampleScene)
  savedScene = JSON.stringify(roomScene)

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url ?? '/', 'http://localhost')
    if (url.pathname !== '/room') {
      socket.destroy()
      return
    }

    sockets.handleUpgrade(request, socket, head, (webSocket) => {
      sockets.emit('connection', webSocket, request)
    })
  })

  sockets.on('connection', (socket) => {
    const person: Person = {
      id: randomUUID(),
      socket,
      selectedObjects: [],
      input: {},
      quiet: false,
    }
    roomState.people[person.id] = person
    if (!roomState.host) roomState.host = person.id
    socket.send(JSON.stringify({ ...snapshot(), you: person.id, scene: diffScene(exampleScene, roomScene) }))
    broadcast(socket)

    socket.on('message', (data) => {
      const current = personFor(socket)
      if (!current) return
      current.quiet = false
      try {
        const text = data.toString()
        const result = parseSafe(roomMessage, JSON.parse(text))
        if (!result.success) return
        const message = result.value
        switch (message.type) {
          case 'scenePatch':
            applyScenePatch(message.scene, roomScene)
            for (const other of Object.values(roomState.people)) {
              if (other.socket !== socket) other.socket.send(text)
            }
            if (roomState.mode !== 'play') setDirty(JSON.stringify(roomScene) !== savedScene)
            break
          case 'modeChange':
            if (message.claim) roomState.host = current.id
            roomState.mode = message.mode
            broadcast()
            break
          case 'cursorUpdate':
            current.cursor = message.cursor
            broadcast()
            break
          case 'selectionUpdate':
            current.selectedObjects = message.selectedObjects
            broadcast()
            break
          case 'inputUpdate':
            current.input = message.input
            broadcast()
            break
        }
      } catch {
        // Ignore a pointer frame that is not JSON.
      }
    })
    socket.on('pong', () => {
      const current = personFor(socket)
      if (current) current.quiet = false
    })
    socket.on('close', () => leave(socket))
    socket.on('error', () => leave(socket))
  })
}

function personFor(socket: WebSocket) {
  return Object.values(roomState.people).find((person) => person.socket === socket)
}

function leave(socket: WebSocket) {
  const person = personFor(socket)
  if (!person) return
  delete roomState.people[person.id]
  if (roomState.host === person.id) roomState.host = Object.keys(roomState.people)[0] ?? ''
  broadcast()
}

function snapshot() {
  const people = Object.fromEntries(
    Object.values(roomState.people).map(({ socket: _socket, quiet: _quiet, ...person }) => [person.id, person]),
  )
  return { mode: roomState.mode, host: roomState.host, dirty: roomState.dirty, people }
}

function setDirty(next: boolean) {
  if (roomState.dirty === next) return
  roomState.dirty = next
  broadcast()
}

function broadcast(except?: WebSocket) {
  const state = snapshot()
  for (const person of Object.values(roomState.people)) {
    if (person.socket === except || person.socket.readyState !== person.socket.OPEN) continue
    person.socket.send(JSON.stringify({ you: person.id, ...state }))
  }
}
