import type * as http from 'node:http'
import { randomUUID } from 'node:crypto'
import { any, array, boolean, defaulted, enum_, literal, number, object, optional, parseSafe, string, union } from 'remix/data-schema'
import { WebSocketServer, type WebSocket } from 'ws'

import type { ScenePath } from './utilities/scene.ts'
import type { WorldPoint } from './utilities/viewport/viewport.ts'

const roomMessage = union([
  object({
    type: defaulted(literal('scenePatch'), 'scenePatch'),
    scene: array(any()),
  }),
  object({
    type: defaulted(literal('modeChange'), 'modeChange'),
    mode: enum_(['edit', 'play']),
    claim: optional(boolean()),
  }),
  object({
    type: defaulted(literal('cursorUpdate'), 'cursorUpdate'),
    cursor: optional(object({ x: number(), y: number() })),
    selectedObjects: optional(array(array(string()))),
  }).refine((message) => message.cursor !== undefined || message.selectedObjects !== undefined),
])

type Person = {
  id: string
  socket: WebSocket
  cursor?: WorldPoint
  selectedObjects: ScenePath[]
  quiet: boolean
}

export type RoomState = {
  mode: 'edit' | 'play'
  host: string
  people: Record<string, Person>
}

const sockets = new WebSocketServer({ noServer: true })
const roomState: RoomState = { mode: 'edit', host: '', people: {} }

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

export function attachRoom(server: http.Server) {
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
    const person: Person = { id: randomUUID(), socket, selectedObjects: [], quiet: false }
    roomState.people[person.id] = person
    if (!roomState.host) roomState.host = person.id
    broadcast()

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
            for (const other of Object.values(roomState.people)) {
              if (other.socket !== socket) other.socket.send(text)
            }
            break
          case 'modeChange':
            if (message.claim) roomState.host = current.id
            roomState.mode = message.mode
            broadcast()
            break
          case 'cursorUpdate':
            current.cursor = message.cursor
            if (message.selectedObjects) current.selectedObjects = message.selectedObjects
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

function broadcast() {
  const people = Object.fromEntries(
    Object.values(roomState.people).map(({ socket: _socket, quiet: _quiet, ...person }) => [person.id, person]),
  )
  for (const person of Object.values(roomState.people)) {
    if (person.socket.readyState !== person.socket.OPEN) continue
    person.socket.send(JSON.stringify({ you: person.id, ...roomState, people }))
  }
}
