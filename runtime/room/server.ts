import type * as http from "node:http";
import { randomUUID } from "node:crypto";
import { parse } from "remix/data-schema";
import { WebSocketServer, type WebSocket } from "ws";

import { roomMessage, type RoomMessage } from "./protocol.ts";

type Member = {
  id: string;
  socket: WebSocket;
  quiet: boolean;
};

const sockets = new WebSocketServer({ noServer: true });
const people = new Map<WebSocket, Member>();

function send(socket: WebSocket, message: RoomMessage) {
  socket.send(JSON.stringify(parse(roomMessage, message)));
}

function broadcast(message: RoomMessage, except?: WebSocket) {
  for (const person of people.values()) {
    if (person.socket === except) continue;
    send(person.socket, message);
  }
}

const roomMessageTypes = new Set(["onRoomJoin", "onPersonJoin", "onPersonLeave"]);

function broadcastRaw(data: string, except?: WebSocket) {
  for (const person of people.values()) {
    if (person.socket === except) continue;
    person.socket.send(data);
  }
}

setInterval(() => {
  for (const person of people.values()) {
    if (person.quiet) {
      people.delete(person.socket);
      person.socket.terminate();
      broadcast({ messageType: "onPersonLeave", id: person.id });
      continue;
    }
    person.quiet = true;
    person.socket.ping();
  }
}, 15000);

export async function attachRoom(server: http.Server) {
  server.on("upgrade", (request, socket, head) => {
    if (!request.url) {
      socket.destroy();
      return;
    }

    const url = new URL(request.url, "http://localhost");
    if (url.pathname !== "/room") {
      socket.destroy();
      return;
    }

    sockets.handleUpgrade(request, socket, head, (webSocket) => {
      sockets.emit("connection", webSocket, request);
    });
  });

  sockets.on("connection", (socket) => {
    const person: Member = { id: randomUUID(), socket, quiet: false };

    people.set(socket, person);

    send(socket, {
      messageType: "onRoomJoin",
      id: person.id,
      people: [...people.values()].map((member) => member.id),
    });

    for (const member of people.values()) {
      send(socket, { messageType: "onPersonJoin", id: member.id });
    }

    broadcast({ messageType: "onPersonJoin", id: person.id }, socket);

    socket.on("message", (raw) => {
      person.quiet = false;

      const text = raw.toString();
      const json = JSON.parse(text);

      const messageType = (json as { messageType?: unknown }).messageType;
      if (typeof messageType === "string" && roomMessageTypes.has(messageType)) return;

      const relay = { ...json, sentBy: person.id };
      broadcastRaw(JSON.stringify(relay), socket);
    });

    socket.on("pong", () => {
      person.quiet = false;
    });

    socket.on("close", () => {
      const member = people.get(socket);
      if (!member) return;
      people.delete(socket);
      broadcast({ messageType: "onPersonLeave", id: member.id });
    });
    
    socket.on("error", () => {
      socket.close();
    });
  });
}
