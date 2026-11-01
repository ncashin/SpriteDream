import { DurableObject } from "cloudflare:workers";

const roomMessageTypes = new Set(["onRoomJoin", "onPersonJoin", "onPersonLeave"]);

type Session = {
	id: string;
};

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

		this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
	}

	async fetch(request: Request): Promise<Response> {
		const upgrade = request.headers.get("Upgrade");
		if (upgrade !== "websocket") {
			return new Response("Expected Upgrade: websocket", { status: 426 });
		}

		const pair = new WebSocketPair();
		const [client, server] = Object.values(pair);
		this.ctx.acceptWebSocket(server);

		const person: Session = { id: crypto.randomUUID() };
		server.serializeAttachment(person);
		this.sessions.set(server, person);

		const people = [...this.sessions.values()].map((member) => member.id);
		this.sendTo(server, JSON.stringify({ messageType: "onRoomJoin", id: person.id, people }));
		this.broadcast({ messageType: "onPersonJoin", id: person.id }, server);

		return new Response(null, { status: 101, webSocket: client });
	}

	async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer) {
		const text = typeof message === "string" ? message : new TextDecoder().decode(message);
		let json: { messageType?: unknown };
		try {
			json = JSON.parse(text) as { messageType?: unknown };
		} catch {
			return;
		}

		if (typeof json.messageType === "string" && roomMessageTypes.has(json.messageType)) return;

		const person = this.sessions.get(socket);
		if (!person) return;

		this.broadcast({ ...json, sentBy: person.id }, socket);
	}

	async webSocketClose(socket: WebSocket, code: number, reason: string) {
		this.leave(socket);
		socket.close(code, reason);
	}

	async webSocketError(socket: WebSocket) {
		this.leave(socket);
		socket.close(1011, "error");
	}

	private leave(socket: WebSocket) {
		const person = this.sessions.get(socket);
		if (!person) return;
		this.sessions.delete(socket);
		this.broadcast({ messageType: "onPersonLeave", id: person.id });
	}

	private broadcast(message: unknown, except?: WebSocket) {
		const data = JSON.stringify(message);
		for (const socket of [...this.sessions.keys()]) {
			if (socket === except) continue;
			this.sendTo(socket, data);
		}
	}

	private sendTo(socket: WebSocket, data: string) {
		try {
			socket.send(data);
		} catch {
			const person = this.sessions.get(socket);
			this.sessions.delete(socket);
			if (!person) return;
			this.broadcast({ messageType: "onPersonLeave", id: person.id });
		}
	}
}

export default {
	async fetch(request, env): Promise<Response> {
		const url = new URL(request.url);
		const match = url.pathname.match(/^\/room\/([^/]+)\/?$/);
		if (!match) {
			return new Response("Open a WebSocket at /room/<name>", { status: 404 });
		}

		const room = env.ROOM.getByName(decodeURIComponent(match[1]));
		return room.fetch(request);
	},
} satisfies ExportedHandler<Env>;
