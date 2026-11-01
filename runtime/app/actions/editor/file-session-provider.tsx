import type { Handle, RemixNode } from "remix/component";

import { createFileSession, type FileSession } from "./file-session.ts";
import { RoomProvider } from "./room-provider.tsx";

export function FileSessionProvider(
  handle: Handle<{ children?: RemixNode }, FileSession>,
) {
  const { room } = handle.context.get(RoomProvider);
  const baseURL = new URL(globalThis.location.href);
  if (!baseURL.pathname.endsWith("/")) baseURL.pathname += "/";

  const fileSession = createFileSession(room, baseURL, handle.signal);
  handle.context.set(fileSession);

  return () => handle.props.children;
}
