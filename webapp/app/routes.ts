import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("game/:gameId", "routes/game.$gameId.tsx"),
  route("game/:gameId/embed/*", "routes/game.$gameId.embed.$.ts"),
] satisfies RouteConfig;
