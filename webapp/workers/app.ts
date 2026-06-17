import { createRequestHandler } from "react-router";

import {
  getEffectiveGameIDEDomain,
  getGameIdFromHost,
} from "../shared/gameId";
import { handleGameBundleRequest } from "./gameBundle";
import { Room } from "./room";

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

export { Room };

export default {
  async fetch(request, env, context) {
    const url = new URL(request.url);

    if (url.pathname === "/room") {
      const room = url.searchParams.get("room")?.trim();
      if (room && request.headers.get("Upgrade") === "websocket") {
        const id = env.ROOM.idFromName(room);
        return env.ROOM.get(id).fetch(request);
      }
    }

    const domain = getEffectiveGameIDEDomain(url, env);
    const gameId = getGameIdFromHost(url.hostname, domain);
    if (gameId) {
      return handleGameBundleRequest(request, env, gameId);
    }

    return requestHandler(request, {
      cloudflare: { env, context },
    });
  },
} satisfies ExportedHandler<Env>;
