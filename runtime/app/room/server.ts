import type * as http from "node:http";
import { randomUUID } from "node:crypto";
import { parse } from "remix/data-schema";
import { WebSocketServer, type WebSocket } from "ws";

import { roomMessage, type Person, type RoomMessage } from "./protocol.ts";

type Member = Person & {
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
      people: [...people.values()].map((member) => ({ id: member.id })),
    });

    for (const member of people.values()) {
      send(socket, { messageType: "onPersonJoin", id: member.id });
    }

    broadcast({ messageType: "onPersonJoin", id: person.id }, socket);

    socket.on("message", () => {
      person.quiet = false;
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
