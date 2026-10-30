import { DurableObject } from 'cloudflare:workers';
import { parse, parseSafe, union } from 'remix/data-schema';

import { editorMessage } from '../../runtime/app/actions/editor/protocol.ts';
import { gameMessage } from '../../runtime/game/protocol.ts';
import { roomMessage, type RoomMessage } from '../../runtime/room/protocol.ts';

const relayedMessage = union([gameMessage, editorMessage]);

type Session = {
	id: string;
};

function send(socket: WebSocket, message: RoomMessage) {
	socket.send(JSON.stringify(parse(roomMessage, message)));
}

/** One Durable Object coordinates the people in a single multiplayer room. */
export class Room extends DurableObject<Env> {
	sessions: Map<WebSocket, Session>;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		this.sessions = new Map();

		for (const socket of this.ctx.getWebSockets()) {
			const attachment = socket.deserializeAttachment() as Session | null;
			if (attachment) this.sessions.set(socket, attachment);
		}

		this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
	}

	async fetch(request: Request): Promise<Response> {
		const upgrade = request.headers.get('Upgrade');
		if (upgrade !== 'websocket') {
			return new Response('Expected Upgrade: websocket', { status: 426 });
		}

		const pair = new WebSocketPair();
		const [client, server] = Object.values(pair);
		this.ctx.acceptWebSocket(server);

		const person: Session = { id: crypto.randomUUID() };
		server.serializeAttachment(person);
		this.sessions.set(server, person);

		const people = [...this.sessions.values()].map((member) => member.id);
		send(server, { messageType: 'onRoomJoin', id: person.id, people });
		for (const id of people) {
			send(server, { messageType: 'onPersonJoin', id });
		}
		this.broadcast({ messageType: 'onPersonJoin', id: person.id }, server);

		return new Response(null, { status: 101, webSocket: client });
	}

	async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer) {
		const text = typeof message === 'string' ? message : new TextDecoder().decode(message);
		let json: unknown;
		try {
			json = JSON.parse(text);
		} catch {
			return;
		}

		if (parseSafe(roomMessage, json).success) return;

		const relayed = parseSafe(relayedMessage, json);
		if (!relayed.success) return;

		const person = this.sessions.get(socket);
		if (!person) return;

		this.broadcastRaw({ ...relayed.value, sentBy: person.id }, socket);
	}

	async webSocketClose(socket: WebSocket, code: number, reason: string) {
		this.leave(socket);
		socket.close(code, reason);
	}

	async webSocketError(socket: WebSocket) {
		this.leave(socket);
		socket.close(1011, 'error');
	}

	private leave(socket: WebSocket) {
		const person = this.sessions.get(socket);
		if (!person) return;
		this.sessions.delete(socket);
		this.broadcast({ messageType: 'onPersonLeave', id: person.id });
	}

	private broadcast(message: RoomMessage, except?: WebSocket) {
		for (const socket of this.sessions.keys()) {
			if (socket === except) continue;
			send(socket, message);
		}
	}

	private broadcastRaw(message: unknown, except?: WebSocket) {
		const data = JSON.stringify(message);
		for (const socket of this.sessions.keys()) {
			if (socket === except) continue;
			socket.send(data);
		}
	}
}

export default {
	async fetch(request, env): Promise<Response> {
		const url = new URL(request.url);
		const match = url.pathname.match(/^\/room\/([^/]+)\/?$/);
		if (!match) {
			return new Response('Open a WebSocket at /room/<name>', { status: 404 });
		}

		const room = env.ROOM.getByName(decodeURIComponent(match[1]));
		return room.fetch(request);
	},
} satisfies ExportedHandler<Env>;
