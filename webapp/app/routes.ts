import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("explore", "routes/explore.tsx"),
  route("game/create", "routes/game.create.ts"),
  route("game/upload/:id", "routes/game.upload.$id.ts"),
  route("game/thumbnail/:id", "routes/game.thumbnail.$id.ts"),
] satisfies RouteConfig;
