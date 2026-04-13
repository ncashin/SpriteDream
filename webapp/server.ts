import compression from "compression";
import { createRequestHandler } from "@react-router/express";
import express from "express";
import morgan from "morgan";
import { createServer } from "node:http";
import { dirname, join, posix, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { attachRoomWebSocket } from "./app/.server/roomWebSocket.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

const port = Number.parseInt(process.env.PORT ?? "", 10) || 3000;
const host = process.env.HOST;

const buildPath = resolve(__dirname, "build/server/index.js");
const build = await import(buildPath);

const { assetsBuildDirectory, publicPath } = build as {
  assetsBuildDirectory: string;
  publicPath: string;
};

const clientRoot = resolve(__dirname, assetsBuildDirectory);

const app = express();
app.disable("x-powered-by");
app.use(compression());
app.use(
  posix.join(publicPath, "assets"),
  express.static(join(clientRoot, "assets"), {
    immutable: true,
    maxAge: "1y",
  }),
);
app.use(publicPath, express.static(clientRoot));
app.use(express.static(join(__dirname, "public"), { maxAge: "1h" }));
app.use(morgan("tiny"));
app.all(
  "*",
  createRequestHandler({
    build,
    mode: process.env.NODE_ENV,
  }),
);

const server = createServer(app);
attachRoomWebSocket(server);

function onListen() {
  const addr = server.address();
  const p = typeof addr === "object" && addr ? addr.port : port;
  console.log(`[server] http://localhost:${p}`);
  console.log(`[server] ws://localhost:${p}/room`);
}

if (host) {
  server.listen(port, host, onListen);
} else {
  server.listen(port, onListen);
}

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => server.close(console.error));
}
