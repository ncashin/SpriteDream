import { css, on, ref } from "remix/component";
import type { Handle } from "remix/component";
import type * as Y from "yjs";

import { blobColor } from "./ui/blobs.tsx";
import { FileSessionProvider } from "./file-session-provider.tsx";
import { PresenceProvider, type Presence } from "./presence-provider.tsx";

export function CodeViewer(
  handle: Handle<{
    path: string;
    text: Y.Text;
    onEdit?: () => void;
  }>,
) {
  const { path, text, onEdit } = handle.props;
  const session = handle.context.get(FileSessionProvider);
  const presence = handle.context.get(PresenceProvider);
  const unsubscribe = session.subscribeFile(path, () => handle.update());
  handle.signal.addEventListener("abort", unsubscribe);

  let sent = "";

  function publishSelection(field: HTMLTextAreaElement) {
    const start = field.selectionStart;
    const end = field.selectionEnd;
    const caret = field.selectionDirection === "backward" ? start : end;
    const next = JSON.stringify({ start, end, caret });
    if (next === sent) return;
    sent = next;
    presence.setSelection({ start, end, caret });
  }

  return () => (
    <div
      mix={css({
        position: "relative",
        height: "100%",
      })}
    >
      <SelectionOverlay />
      <textarea
        spellCheck={false}
        value={text.toString()}
        mix={[
          css({
            boxSizing: "border-box",
            border: "none",
            background: "transparent",
            color: "inherit",
            font: "inherit",
            height: "100%",
            margin: 0,
            outline: "none",
            overflow: "auto",
            padding: "1rem",
            position: "relative",
            resize: "none",
            whiteSpace: "pre",
            width: "100%",
            zIndex: 1,
          }),
          on("input", (event) => {
            session.write(path, event.currentTarget.value);
            onEdit?.();
            publishSelection(event.currentTarget);
            handle.update();
          }),
          on("select", (event) => {
            publishSelection(event.currentTarget);
          }),
          on("keyup", (event) => {
            publishSelection(event.currentTarget);
          }),
          on("pointerup", (event) => {
            publishSelection(event.currentTarget);
          }),
          ref((node, signal) => {
            if (!(node instanceof HTMLTextAreaElement)) return;
            const sync = () => {
              if (node.ownerDocument.activeElement !== node) return;
              publishSelection(node);
            };
            node.ownerDocument.addEventListener("selectionchange", sync);
            signal.addEventListener("abort", () => {
              node.ownerDocument.removeEventListener("selectionchange", sync);
              presence.clearSelection();
            });
          }),
        ]}
      />
    </div>
  );
}

function textCaret(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const start = Reflect.get(value, "start");
  const end = Reflect.get(value, "end");
  const caret = Reflect.get(value, "caret");
  if (typeof start !== "number" || typeof end !== "number") return null;
  const from = Math.min(start, end);
  const to = Math.max(start, end);
  const at = typeof caret === "number" ? caret : to;
  return { start: from, end: to, caret: at };
}

function SelectionOverlay(handle: Handle) {
  const presence = handle.context.get(PresenceProvider);

  return () => (
    <div
      mix={[
        css({
          position: "absolute",
          inset: 0,
          overflow: "hidden",
          pointerEvents: "none",
          zIndex: 0,
        }),
        ref((node, signal) => {
          if (!(node instanceof HTMLDivElement)) return;
          let frame = 0;
          let stop = () => {};
          const start = () => {
            const field = node.parentElement?.querySelector("textarea");
            if (!(field instanceof HTMLTextAreaElement)) {
              frame = requestAnimationFrame(start);
              return;
            }
            stop = mountSelectionOverlay(node, field, presence);
          };
          start();
          signal.addEventListener("abort", () => {
            cancelAnimationFrame(frame);
            stop();
          });
        }),
      ]}
    />
  );
}

function mountSelectionOverlay(
  node: HTMLDivElement,
  field: HTMLTextAreaElement,
  presence: Presence,
) {
  const content = node.ownerDocument.createElement("div");
  content.style.position = "absolute";
  content.style.left = "0";
  content.style.top = "0";
  node.append(content);

  const mirror = node.ownerDocument.createElement("div");
  const style = getComputedStyle(field);
  mirror.style.position = "absolute";
  mirror.style.left = "0";
  mirror.style.top = "0";
  mirror.style.visibility = "hidden";
  mirror.style.whiteSpace = "pre";
  mirror.style.boxSizing = "border-box";
  mirror.style.padding = "1rem";
  mirror.style.font = style.font;
  mirror.style.lineHeight = style.lineHeight;
  mirror.style.letterSpacing = style.letterSpacing;
  mirror.style.tabSize = style.tabSize;
  content.append(mirror);

  const paint = () => {
    const source = field.value;
    mirror.style.width = `${field.clientWidth}px`;
    mirror.textContent = `${source}\n`;
    content.style.transform = `translate(${-field.scrollLeft}px, ${-field.scrollTop}px)`;
    for (const box of content.querySelectorAll("[data-selection]")) box.remove();
    const textNode = mirror.firstChild;
    if (!textNode) return;
    const origin = mirror.getBoundingClientRect();
    for (const id in presence.selections) {
      const range = textCaret(presence.selections[id]);
      if (!range) continue;
      const color = blobColor(id);
      const start = Math.max(0, Math.min(range.start, source.length));
      const end = Math.max(start, Math.min(range.end, source.length));
      if (start !== end) {
        const domRange = node.ownerDocument.createRange();
        domRange.setStart(textNode, start);
        domRange.setEnd(textNode, end);
        for (const rect of lineRects(domRange)) {
          const box = node.ownerDocument.createElement("div");
          box.dataset.selection = id;
          box.style.position = "absolute";
          box.style.left = `${rect.left - origin.left}px`;
          box.style.top = `${rect.top - origin.top}px`;
          box.style.width = `${rect.width}px`;
          box.style.height = `${rect.height}px`;
          box.style.background = color;
          box.style.opacity = "0.35";
          content.append(box);
        }
      }
      const caret = caretRect(textNode, range.caret, source.length);
      if (!caret) continue;
      const mark = node.ownerDocument.createElement("div");
      mark.dataset.selection = id;
      mark.style.position = "absolute";
      mark.style.left = `${caret.left - origin.left}px`;
      mark.style.top = `${caret.top - origin.top}px`;
      mark.style.width = "2px";
      mark.style.height = `${caret.height}px`;
      mark.style.background = color;
      content.append(mark);
    }
  };

  paint();
  field.addEventListener("scroll", paint);
  const stop = presence.subscribe(paint);
  return () => {
    field.removeEventListener("scroll", paint);
    stop();
    content.remove();
  };
}

function caretRect(textNode: Node, index: number, length: number) {
  const text = textNode.textContent ?? "";
  const at = Math.max(0, Math.min(index, length, text.length));
  const range = textNode.ownerDocument.createRange();
  const box = (from: number, to: number) => {
    range.setStart(textNode, from);
    range.setEnd(textNode, to);
    return lineRects(range).at(-1);
  };
  if (at < text.length && text[at] !== "\n") {
    const rect = box(at, at + 1);
    if (rect) return { left: rect.left, top: rect.top, height: rect.height };
  }
  if (at > 0) {
    const rect = box(at - 1, at);
    if (rect) return { left: rect.right, top: rect.top, height: rect.height };
  }
  const rect = box(0, Math.min(1, text.length));
  if (!rect || rect.height === 0) return null;
  return { left: rect.left, top: rect.top, height: rect.height };
}

function lineRects(range: Range) {
  return [...range.getClientRects()].filter((rect) => rect.width > 0 && rect.height > 0);
}
