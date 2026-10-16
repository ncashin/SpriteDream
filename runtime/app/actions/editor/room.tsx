import { clientEntry, css, ref } from "remix/component";
import type { Handle } from "remix/component";

import { Mode, setMode } from "../../utilities/mode.ts";
import { playerColor } from "../../utilities/player-color.ts";

type Person = { id: string; x: number | null; y: number | null; selected?: string[][] };

type RoomConnection = {
  socket: WebSocket;
  you: string;
  host: string;
  mode: Mode;
  people: Person[];
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
    host: "",
    mode: Mode.Edit,
    people: [],
    stop: new AbortController(),
    bound: false,
  };
  Reflect.set(globalThis, "spritedreamRoom", next);
  return next;
}

export function syncMode(next: Mode) {
  const room = connection();
  room.mode = next;
  const starting = next === Mode.Play;
  if (starting && room.you) room.host = room.you;
  setMode(next, starting || (room.you !== "" && room.you === room.host));
  if (room.socket.readyState === WebSocket.OPEN) {
    room.socket.send(JSON.stringify({ mode: next, claim: starting }));
  }
}

export const Room = clientEntry(import.meta.url, function Room(handle: Handle) {
  let you = "";
  let people: Person[] = [];
  let sharedMode = Mode.Edit;
  let host = "";
  let cursorsFor = new Map<string, HTMLElement>();

  if (typeof location !== "undefined") {
    const room = connection();
    const socket = room.socket;
    you = room.you;
    people = room.people;
    sharedMode = room.mode;
    host = room.host;
    if (!room.bound) {
      room.bound = true;
      const signal = room.stop.signal;
      socket.addEventListener("message", (event) => {
        const message = JSON.parse(String(event.data)) as {
          you?: string;
          people?: Person[];
          scene?: unknown;
          mode?: string;
          host?: string;
        };
        if (message.mode === Mode.Edit || message.mode === Mode.Play) sharedMode = message.mode;
        if (Array.isArray(message.scene)) {
          window.postMessage({ scene: message.scene }, location.origin);
          return;
        }
        if (!message.you || !message.people) return;
        you = message.you;
        people = message.people;
        host = message.people.some((person) => person.id === message.host) ? message.host! : message.people[0]?.id ?? "";
        room.you = you;
        room.people = people;
        room.mode = sharedMode;
        room.host = host;
        setMode(sharedMode, you !== "" && you === host);
        const space = canvasView()?.spritedream;
        if (space) {
          space.remoteSelections = people
            .filter((person) => person.id !== you)
            .map((person) => ({
              id: person.id,
              color: playerColor(person.id),
              paths: person.selected ?? [],
            }));
        }
        handle.update();
      }, { signal });
      window.addEventListener("message", (event) => {
        if (event.origin !== location.origin || !event.data?.local || !Array.isArray(event.data.scene)) return;
        if (socket.readyState !== WebSocket.OPEN) return;
        socket.send(JSON.stringify({ scene: event.data.scene }));
      }, { signal });

      let point: { x: number; y: number } | null = null;
      let selectedKey = "";
      let queued = false;
      const sendState = () => {
        queued = false;
        if (socket.readyState !== WebSocket.OPEN) return;
        const selected = canvasView()?.spritedream?.selection() ?? [];
        selectedKey = selected.map((path) => path.join("\0")).join("\n");
        socket.send(JSON.stringify({ x: point?.x ?? null, y: point?.y ?? null, selected }));
      };
      const queueSend = () => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(sendState);
      };
      const move = (event: PointerEvent) => {
        const view = canvasView();
        if (!view?.spritedream) return;
        const local = toViewClient(event, view);
        point = view.spritedream.screenToWorld(local.x, local.y);
        queueSend();
      };
      const hide = () => {
        point = null;
        queueSend();
      };
      const watchSelection = () => {
        const next = canvasView()?.spritedream?.selection() ?? [];
        const key = next.map((path) => path.join("\0")).join("\n");
        if (key !== selectedKey) queueSend();
        requestAnimationFrame(watchSelection);
      };
      requestAnimationFrame(watchSelection);
      const seen = new WeakSet<Window>();
      const watch = (view: Window) => {
        if (seen.has(view)) return;
        seen.add(view);
        view.addEventListener("pointermove", move);
        view.addEventListener("blur", hide);
        view.document.addEventListener("pointerleave", (event) => {
          if (event.relatedTarget == null) hide();
        });
      };
      const watchFrames = () => {
        watch(window);
        for (const frame of document.querySelectorAll("iframe")) {
          try {
            if (frame.contentWindow) watch(frame.contentWindow);
          } catch {
            // A cross-origin frame has no pointer coordinates to share.
          }
        }
      };
      watchFrames();
      new MutationObserver(watchFrames).observe(document.documentElement, { childList: true, subtree: true });

      const nodes = new Map<string, HTMLElement>();
      cursorsFor = nodes;
      const place = () => {
        const view = canvasView();
        const space = view?.spritedream;
        const origin = view ? canvasOrigin(view) : undefined;
        for (const [id, node] of nodes) {
          const person = people.find((entry) => entry.id === id);
          if (!person || person.x == null || person.y == null || !space || !origin) continue;
          const screen = space.worldToScreen(person.x, person.y);
          node.style.left = `${origin.left + screen.x}px`;
          node.style.top = `${origin.top + screen.y}px`;
        }
        requestAnimationFrame(place);
      };
      requestAnimationFrame(place);
    }
  }

  return () => (
    <>
      <ul aria-label="People in the room" mix={list}>
        {people.map((person) => (
          <li key={person.id} title={person.id === host ? "Host" : person.id}>
            {faceFor(person.id)}
          </li>
        ))}
      </ul>
      <div mix={cursors}>
        {people
          .filter((person) => person.id !== you && person.x != null && person.y != null)
          .map((person) => (
            <div
              key={person.id}
              mix={[
                cursor,
                ref((node, signal) => {
                  if (!(node instanceof HTMLElement)) return;
                  cursorsFor.set(person.id, node);
                  signal.addEventListener("abort", () => {
                    if (cursorsFor.get(person.id) === node) cursorsFor.delete(person.id);
                  });
                }),
              ]}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87a.5.5 0 0 0 .35-.85L6.35 2.86a.5.5 0 0 0-.85.35Z"
                  fill={playerColor(person.id)}
                  stroke="#fff"
                  stroke-width="1.5"
                  stroke-linejoin="round"
                />
              </svg>
              <span mix={name} style={{ background: playerColor(person.id) }}>
                {person.id.slice(0, 4)}
              </span>
            </div>
          ))}
      </div>
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

function canvasView() {
  if (window.spritedream) return window;
  const frame = document.querySelector("iframe");
  if (frame?.contentWindow?.spritedream) return frame.contentWindow;
}

function toViewClient(event: PointerEvent, view: Window) {
  if (event.view === view) return { x: event.clientX, y: event.clientY };
  const frame = view.frameElement;
  if (!(frame instanceof HTMLElement)) return { x: event.clientX, y: event.clientY };
  const box = frame.getBoundingClientRect();
  return { x: event.clientX - box.left, y: event.clientY - box.top };
}

function canvasOrigin(view: Window) {
  const canvas = view.document.querySelector("canvas");
  if (!canvas) return;
  const local = canvas.getBoundingClientRect();
  const frame = view.frameElement;
  if (!(frame instanceof HTMLElement)) return local;
  const box = frame.getBoundingClientRect();
  return { left: box.left + local.left, top: box.top + local.top };
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

const cursors = css({
  inset: 0,
  pointerEvents: "none",
  position: "fixed",
  zIndex: 30,
});

const cursor = css({
  position: "absolute",
});

const name = css({
  borderRadius: "0.15rem 0.7rem 0.7rem 0.7rem",
  color: "#fff",
  fontSize: "0.6875rem",
  fontWeight: 600,
  left: "0.7rem",
  lineHeight: "1rem",
  padding: "0.05rem 0.4rem 0.1rem",
  position: "absolute",
  top: "1rem",
  whiteSpace: "nowrap",
});
