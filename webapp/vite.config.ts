import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import type { Plugin } from "vite";
import { defineConfig } from "vite";
import { attachRoomWebSocket } from "./app/.server/roomWebSocket";

function roomWebSocketPlugin(): Plugin {
  return {
    name: "room-websocket",
    configureServer(server) {
      return () => {
        if (server.httpServer) {
          attachRoomWebSocket(server.httpServer);
        }
      };
    },
  };
}

export default defineConfig({
  plugins: [tailwindcss(), reactRouter(), roomWebSocketPlugin()],
  resolve: {
    tsconfigPaths: true,
  },
});
