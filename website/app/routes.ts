import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("coming-soon", "routes/coming-soon.tsx"),
  route("explore", "routes/explore.tsx"),
  route("upload", "routes/upload.tsx"),
  route("games/:id", "routes/games.$id.tsx"),
  route("api/games/:id/thumbnail", "routes/api.games.$id.thumbnail.ts"),
  route("api/games/:id/download", "routes/api.games.$id.download.ts"),
  route("api/games/:id/bundle/*", "routes/api.games.$id.bundle.ts"),
  route("api/runtime/*", "routes/api.runtime.$.ts"),
  route("assets/*", "routes/assets.$.ts"),
] satisfies RouteConfig;
