import { any, array, boolean, enum_, number, object, optional, parseSafe, record, string, union } from "remix/data-schema";
import type { InferOutput } from "remix/data-schema";

import { Mode, setMode } from "../../utilities/mode.ts";
import type { ScenePatch, ScenePath } from "../../utilities/scene.ts";
import type { WorldPoint } from "../../utilities/viewport/viewport.ts";

const person = object({
  id: string(),
  cursor: optional(object({ x: number(), y: number() })),
  selectedObjects: optional(array(array(string()))),
  input: optional(record(string(), union([number(), boolean()]))),
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

const serverMessage = union([roomSnapshot, scenePatch]);

type Person = InferOutput<typeof person>;

type RoomState = {
  mode: Mode;
  host: string;
  dirty: boolean;
  people: Record<string, Person>;
};

export type RoomHandlers = {
  onOtherPlayerJoin?: (person: Person) => void;
  onOtherPlayerLeave?: (person: Person) => void;
  onScene?: (scene: ScenePatch) => void;
  onModeChange?: (mode: Mode) => void;
  onHostChange?: (host: string) => void;
  onDirtyChange?: (dirty: boolean) => void;
};

type RoomConnection = {
  socket: WebSocket;
  you: string;
  state: RoomState;
  handlers: RoomHandlers[];
  sendScenePatch: (patch: ScenePatch) => void;
  sendCursor: (cursor: WorldPoint) => void;
  sendSelectedObjects: (selectedObjects: ScenePath[]) => void;
  sendInput: (input: Record<string, number | boolean>) => void;
  readonly isHost: boolean;
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

export function joinRoom(signal: AbortSignal, handlers: RoomHandlers = {}): RoomConnection {
  const existing = liveRoom();
  if (existing) {
    remember(existing, signal, handlers);
    return existing;
  }
  const stale = Reflect.get(globalThis, "spritedreamRoom") as RoomConnection | undefined;
  stale?.socket.close();
  const next: RoomConnection = {
    socket: new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/room`),
    you: "",
    state: { mode: Mode.Edit, host: "", dirty: false, people: {} },
    handlers: [],
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
    sendInput(input) {
      if (this.socket.readyState !== WebSocket.OPEN) return;
      this.socket.send(JSON.stringify({ type: "inputUpdate", input }));
    },
    get isHost() {
      return this.you !== "" && this.you === this.state.host;
    },
  };
  remember(next, signal, handlers);
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
    if (!("you" in message)) {
      dispatch(next, (entry) => entry.onScene?.(message.scene as ScenePatch));
      return;
    }
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
      dispatch(next, (entry) => entry.onOtherPlayerLeave?.(departure));
    }
  }, { signal });
  Reflect.set(globalThis, "spritedreamRoom", next);
  return next;
}

export function syncMode(next: Mode) {
  const room = liveRoom();
  if (!room) {
    setMode(next, next === Mode.Play);
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
