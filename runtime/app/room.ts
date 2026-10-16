import { createHash, randomUUID } from 'node:crypto'
import type * as http from 'node:http'
import type { Duplex } from 'node:stream'

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'

type Person = { id: string; x: number | null; y: number | null; selected: string[][]; quiet: boolean }

const people = new Map<Duplex, Person>()
let roomMode: 'edit' | 'play' = 'edit'
let hostSocket: Duplex | undefined

setInterval(() => {
  for (const [socket, person] of people) {
    if (person.quiet) {
      socket.destroy()
      leave(socket)
      continue
    }
    person.quiet = true
    try {
      socket.write(Buffer.from([0x89, 0x00]))
    } catch {
      leave(socket)
    }
  }
}, 15000)

export function attachRoom(server: http.Server) {
  server.on('upgrade', (request, socket) => {
    const url = new URL(request.url ?? '/', 'http://localhost')
    if (url.pathname !== '/room') {
      socket.destroy()
      return
    }

    const key = request.headers['sec-websocket-key']
    if (typeof key !== 'string') {
      socket.destroy()
      return
    }

    const accept = createHash('sha1').update(key + GUID).digest('base64')
    socket.write(
      `HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`,
    )

    people.set(socket, { id: randomUUID(), x: null, y: null, selected: [], quiet: false })
    broadcast()

    let pending = Buffer.alloc(0) as Buffer
    socket.on('data', (chunk) => {
      pending = Buffer.concat([pending, chunk])
      pending = readFrames(socket, pending)
    })
    socket.on('close', () => leave(socket))
    socket.on('error', () => leave(socket))
  })
}

function leave(socket: Duplex) {
  if (!people.delete(socket)) return
  if (hostSocket === socket) hostSocket = undefined
  broadcast()
}

function prune() {
  for (const socket of people.keys()) {
    if (!socket.destroyed && !socket.writableEnded) continue
    people.delete(socket)
    if (hostSocket === socket) hostSocket = undefined
  }
}

function hostId() {
  prune()
  if (!hostSocket || !people.has(hostSocket)) hostSocket = people.keys().next().value
  return hostSocket ? people.get(hostSocket)?.id ?? '' : ''
}

function broadcast() {
  const roster = [...people.values()]
  const host = hostId()
  for (const [socket, person] of people) {
    sendText(socket, JSON.stringify({ you: person.id, people: roster, mode: roomMode, host }))
  }
}

function sendText(socket: Duplex, text: string) {
  const payload = Buffer.from(text)
  const header =
    payload.length < 126
      ? Buffer.from([0x81, payload.length])
      : Buffer.from([0x81, 126, (payload.length >> 8) & 0xff, payload.length & 0xff])
  socket.write(Buffer.concat([header, payload]))
}

function readFrames(socket: Duplex, data: Buffer): Buffer {
  while (data.length >= 2) {
    const opcode = data[0] & 0x0f
    const masked = (data[1] & 0x80) !== 0
    let length = data[1] & 0x7f
    let offset = 2
    if (length === 126) {
      if (data.length < 4) return data
      length = data.readUInt16BE(2)
      offset = 4
    } else if (length === 127) {
      if (data.length < 10) return data
      length = Number(data.readBigUInt64BE(2))
      offset = 10
    }
    const maskLength = masked ? 4 : 0
    if (data.length < offset + maskLength + length) return data
    const payload = data.subarray(offset + maskLength, offset + maskLength + length)
    if (masked) {
      const mask = data.subarray(offset, offset + 4)
      for (let index = 0; index < payload.length; index++) payload[index] ^= mask[index % 4]
    }
    if (opcode === 0x1) {
      const person = people.get(socket)
      if (person) {
        try {
          const text = payload.toString('utf8')
          const message = JSON.parse(text) as {
            x?: unknown
            y?: unknown
            selected?: unknown
            scene?: unknown
            mode?: unknown
            claim?: unknown
          }
          person.quiet = false
          if (message.claim === true) hostSocket = socket
          if (message.mode === 'edit' || message.mode === 'play') {
            roomMode = message.mode
            broadcast()
          }
          if (Array.isArray(message.scene)) {
            for (const other of people.keys()) {
              if (other !== socket) sendText(other, text)
            }
          } else if ('x' in message || 'y' in message || 'selected' in message) {
            person.x = typeof message.x === 'number' ? message.x : null
            person.y = typeof message.y === 'number' ? message.y : null
            if (Array.isArray(message.selected)) {
              person.selected = message.selected.filter(
                (path): path is string[] =>
                  Array.isArray(path) && path.every((key) => typeof key === 'string'),
              )
            }
            broadcast()
          }
        } catch {
          // Ignore a pointer frame that is not JSON.
        }
      }
    } else if (opcode === 0xa) {
      const person = people.get(socket)
      if (person) person.quiet = false
    } else if (opcode === 0x8) {
      socket.end()
      leave(socket)
    } else if (opcode === 0x9) {
      socket.write(Buffer.concat([Buffer.from([0x8a, payload.length]), payload]))
    }
    data = data.subarray(offset + maskLength + length)
  }
  return data
}
