import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("game/:gameId", "routes/game.$gameId.tsx"),
  route("game/:gameId/upload", "routes/game.$gameId.upload.ts"),
  route("game/:gameId/embed/*", "routes/game.$gameId.embed.$.ts"),
  route("game/:gameId/webrtc-signal", "routes/game.$gameId.webrtc-signal.ts"),
] satisfies RouteConfig;
