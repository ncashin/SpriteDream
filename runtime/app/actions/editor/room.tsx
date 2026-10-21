import { any, array, boolean, enum_, literal, number, object, optional, parseSafe, record, string, union } from "remix/data-schema";
import type { InferInput, InferOutput, Schema } from "remix/data-schema";

import { Mode, setMode } from "../../utilities/mode.ts";
import type { ScenePatch, ScenePath } from "../../utilities/scene.ts";
import type { WorldPoint } from "../../utilities/viewport/viewport.ts";

const person = object({
  id: string(),
  cursor: optional(object({ x: number(), y: number() })),
  selectedObjects: optional(array(array(string()))),
});

const scene = array(object({ path: array(string()), value: optional(any()) }));

const roomSnapshot = object({
  you: string(),
  mode: enum_([Mode.Edit, Mode.Play]),
  host: string(),
  dirty: boolean(),
  people: record(string(), person),
  scene: optional(scene),
});

const scenePatch = object({ scene });

const relayedMessage = object({
  type: literal("message"),
  name: string(),
  from: string(),
  data: any(),
});

const serverMessage = union([roomSnapshot, scenePatch, relayedMessage]);

type Person = InferOutput<typeof person>;

type RoomState = {
  mode: Mode;
  host: string;
  dirty: boolean;
  people: Record<string, Person>;
};

export type RoomHandlers = {
  onOtherPlayerJoin?: (person: Person) => void;
  onPersonLeave?: (person: Person) => void;
  onScene?: (scene: ScenePatch) => void;
  onModeChange?: (mode: Mode) => void;
  onHostChange?: (host: string) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onMessage?: (message: { name: string; from: string; data: unknown }) => void;
};

type MessageSchemas = Record<string, Schema<any, any>>;

type MessageEvent<M extends MessageSchemas> = {
  [Name in keyof M & string]: { name: Name; from: string; data: InferOutput<M[Name]> };
}[keyof M & string];

type RoomOptions<M extends MessageSchemas> = Omit<RoomHandlers, "onMessage"> & {
  messages?: M;
  onMessage?: (message: MessageEvent<M>) => void;
};

export type Room<M extends MessageSchemas = {}> = {
  you: string;
  state: RoomState;
  sendScenePatch: (patch: ScenePatch) => void;
  sendCursor: (cursor: WorldPoint) => void;
  sendSelectedObjects: (selectedObjects: ScenePath[]) => void;
  send: <Name extends keyof M & string>(name: Name, data: InferInput<M[Name]>) => void;
  readonly isHost: boolean;
};

type RoomConnection = Room & {
  socket: WebSocket;
  handlers: RoomHandlers[];
  schemas: MessageSchemas;
};

function liveRoom(): RoomConnection | undefined {
  const existing = Reflect.get(globalThis, "spritedreamRoom") as RoomConnection | undefined;
  if (existing && existing.socket.readyState <= WebSocket.OPEN) return existing;
  return undefined;
}

function remember(room: RoomConnection, signal: AbortSignal, handlers: RoomHandlers) {
  room.handlers.push(handlers);
  signal.addEventListener("abort", () => {
    room.handlers = room.handlers.filter((entry) => entry !== handlers);
  });
}

function dispatch(room: RoomConnection, call: (handlers: RoomHandlers) => void) {
  for (const handlers of room.handlers) call(handlers);
}

export function joinRoom<M extends MessageSchemas = {}>(
  signal: AbortSignal,
  options: RoomOptions<M> = {},
): Room<M> {
  const { messages = {} as M, ...handlers } = options;
  const existing = liveRoom();
  if (existing) {
    Object.assign(existing.schemas, messages);
    remember(existing, signal, handlers as RoomHandlers);
    return existing;
  }
  const stale = Reflect.get(globalThis, "spritedreamRoom") as RoomConnection | undefined;
  stale?.socket.close();
  const next: RoomConnection = {
    socket: new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/room`),
    you: "",
    state: { mode: Mode.Edit, host: "", dirty: false, people: {} },
    handlers: [],
    schemas: { ...messages },
    sendScenePatch(patch) {
      if (this.socket.readyState !== WebSocket.OPEN) return;
      this.socket.send(JSON.stringify({ type: "scenePatch", scene: patch }));
    },
    sendCursor(cursor) {
      if (this.socket.readyState !== WebSocket.OPEN) return;
      this.socket.send(JSON.stringify({ type: "cursorUpdate", cursor }));
    },
    sendSelectedObjects(selectedObjects) {
      if (this.socket.readyState !== WebSocket.OPEN) return;
      this.socket.send(JSON.stringify({ type: "selectionUpdate", selectedObjects }));
    },
    send(name, data) {
      if (this.socket.readyState !== WebSocket.OPEN) return;
      this.socket.send(JSON.stringify({ type: "message", name, data }));
    },
    get isHost() {
      return this.you !== "" && this.you === this.state.host;
    },
  };
  remember(next, signal, handlers as RoomHandlers);
  signal.addEventListener("abort", () => {
    if (Reflect.get(globalThis, "spritedreamRoom") === next) next.socket.close();
  });
  next.socket.addEventListener("message", (event) => {
    let payload: unknown;
    try {
      payload = JSON.parse(String(event.data));
    } catch {
      return;
    }
    const result = parseSafe(serverMessage, payload);
    if (!result.success) return;
    const message = result.value;
    if ("you" in message) {
      const previous = next.state;
      next.you = message.you;
      next.state = { mode: message.mode, host: message.host, dirty: message.dirty, people: message.people };
      if (message.scene) dispatch(next, (entry) => entry.onScene?.(message.scene as ScenePatch));
      if (previous.mode !== message.mode) dispatch(next, (entry) => entry.onModeChange?.(message.mode));
      if (previous.host !== message.host) dispatch(next, (entry) => entry.onHostChange?.(message.host));
      if (previous.dirty !== message.dirty) dispatch(next, (entry) => entry.onDirtyChange?.(message.dirty));
      for (const arrival of Object.values(message.people)) {
        if (arrival.id === message.you || previous.people[arrival.id]) continue;
        dispatch(next, (entry) => entry.onOtherPlayerJoin?.(arrival));
      }
      for (const departure of Object.values(previous.people)) {
        if (departure.id === message.you || message.people[departure.id]) continue;
        dispatch(next, (entry) => entry.onPersonLeave?.(departure));
      }
      return;
    }
    if ("scene" in message) {
      dispatch(next, (entry) => entry.onScene?.(message.scene as ScenePatch));
      return;
    }
    const schema = next.schemas[message.name];
    if (!schema) return;
    const parsed = parseSafe(schema, message.data);
    if (!parsed.success) return;
    dispatch(next, (entry) =>
      entry.onMessage?.({ name: message.name, from: message.from, data: parsed.value }),
    );
  }, { signal });
  Reflect.set(globalThis, "spritedreamRoom", next);
  return next;
}

export function syncMode(next: Mode) {
  const room = liveRoom();
  if (!room) {
    setMode(next);
    return;
  }
  const starting = next === Mode.Play;
  const modeChanged = room.state.mode !== next;
  const hostChanged = starting && room.you !== "" && room.state.host !== room.you;
  room.state.mode = next;
  if (hostChanged) room.state.host = room.you;
  if (modeChanged) dispatch(room, (entry) => entry.onModeChange?.(next));
  if (hostChanged) dispatch(room, (entry) => entry.onHostChange?.(room.state.host));
  if (room.socket.readyState === WebSocket.OPEN) {
    room.socket.send(JSON.stringify({ mode: next, claim: starting }));
  }
}
