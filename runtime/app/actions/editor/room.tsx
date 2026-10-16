import { clientEntry, css } from "remix/component";
import type { Handle } from "remix/component";

import { Mode, setMode } from "../../utilities/mode.ts";
import { playerColor } from "../../utilities/player-color.ts";
import type { ScenePath } from "../../utilities/scene.ts";

type Person = { id: string; cursor: { x: number; y: number } | null; selectedObjects?: ScenePath[] };

type RoomState = {
  mode: Mode;
  host: string;
  people: Record<string, Person>;
};

type RoomConnection = {
  socket: WebSocket;
  you: string;
  state: RoomState;
  stop: AbortController;
  bound: boolean;
};

function connection(): RoomConnection {
  const existing = Reflect.get(globalThis, "spritedreamRoom") as RoomConnection | undefined;
  if (existing && existing.socket.readyState <= WebSocket.OPEN) return existing;
  existing?.socket.close();
  existing?.stop.abort();
  const next: RoomConnection = {
    socket: new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/room`),
    you: "",
    state: { mode: Mode.Edit, host: "", people: {} },
    stop: new AbortController(),
    bound: false,
  };
  Reflect.set(globalThis, "spritedreamRoom", next);
  return next;
}

export function syncMode(next: Mode) {
  const room = connection();
  room.state.mode = next;
  const starting = next === Mode.Play;
  if (starting && room.you) room.state.host = room.you;
  setMode(next, starting || (room.you !== "" && room.you === room.state.host));
  if (room.socket.readyState === WebSocket.OPEN) {
    room.socket.send(JSON.stringify({ mode: next, claim: starting }));
  }
}

export const Room = clientEntry(import.meta.url, function Room(handle: Handle) {
  let you = "";
  let people: Record<string, Person> = {};
  let sharedMode = Mode.Edit;
  let host = "";

  if (typeof location !== "undefined") {
    const room = connection();
    const socket = room.socket;
    you = room.you;
    people = room.state.people;
    sharedMode = room.state.mode;
    host = room.state.host;
    if (!room.bound) {
      room.bound = true;
      const signal = room.stop.signal;
      socket.addEventListener("message", (event) => {
        const message = JSON.parse(String(event.data)) as {
          you?: string;
          people?: Record<string, Person>;
          scene?: unknown;
          mode?: string;
          host?: string;
        };
        if (Array.isArray(message.scene)) {
          window.postMessage({ scene: message.scene }, location.origin);
          return;
        }
        if (!message.you || !message.people || Array.isArray(message.people) || (message.mode !== Mode.Edit && message.mode !== Mode.Play)) return;
        you = message.you;
        people = message.people;
        host = message.host ?? "";
        sharedMode = message.mode;
        room.you = you;
        room.state = { mode: sharedMode, host, people };
        setMode(sharedMode, you !== "" && you === host);
        handle.update();
      }, { signal });
      window.addEventListener("message", (event) => {
        if (event.origin !== location.origin || !event.data?.local || !Array.isArray(event.data.scene)) return;
        if (socket.readyState !== WebSocket.OPEN) return;
        socket.send(JSON.stringify({ scene: event.data.scene }));
      }, { signal });
    }
  }

  return () => (
    <>
      <ul aria-label="People in the room" mix={list}>
        {Object.values(people).map((person) => (
          <li key={person.id} title={person.id === host ? "Host" : person.id}>
            {faceFor(person.id)}
          </li>
        ))}
      </ul>
    </>
  );
});

const blobs = [
  "M24 118.876C-14.4 95.6761 42.5 29.5051 74.5 1.50516C57.7 39.1051 81.4999 80.5051 95.4999 96.5051C88.4999 112.172 62.4 142.076 24 118.876Z",
  "M50 122C18 124 4 96 10 68C16 36 34 8 54 10C80 14 100 42 96 74C92 106 78 122 50 122Z",
  "M77 118.876C115.4 95.6761 58.5 29.5051 26.5 1.50516C43.3 39.1051 19.5 80.5051 5.5 96.5051C12.5 112.172 38.6 142.076 77 118.876Z",
  "M50 116C22 120 6 98 12 72C18 42 32 18 50 16C72 18 98 40 94 72C90 104 74 116 50 116Z",
];

function faceFor(id: string) {
  return (
    <svg viewBox="0 0 101 130" aria-hidden="true" mix={face}>
      <path d={blobs[hash(id) % blobs.length]} fill={playerColor(id)} stroke="black" stroke-width="4" stroke-linejoin="round" />
      <path d="M19 112C28.4 112 36 104.4 36 95C36 85.6 28.4 78 19 78C9.6 78 2 85.6 2 95C2 104.4 9.6 112 19 112Z" fill="#D9D9D9" stroke="black" stroke-width="4" />
      <path d="M82 112C91.4 112 99 104.4 99 95C99 85.6 91.4 78 82 78C72.6 78 65 85.6 65 95C65 104.4 72.6 112 82 112Z" fill="#D9D9D9" stroke="black" stroke-width="4" />
    </svg>
  );
}

function hash(value: string) {
  let total = 0;
  for (const char of value) total = (total * 33 + char.charCodeAt(0)) >>> 0;
  return total;
}

const list = css({
  alignItems: "center",
  alignSelf: "center",
  display: "flex",
  flex: "0 0 auto",
  gap: "0.375rem",
  listStyle: "none",
  margin: 0,
  marginLeft: "auto",
  padding: 0,
  pointerEvents: "none",
});

const face = css({
  display: "block",
  flex: "0 0 auto",
  height: "1.75rem",
  width: "1.4rem",
});
