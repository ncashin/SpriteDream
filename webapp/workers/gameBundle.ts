import { getGameById } from "~/.server/database/game";
import { readGameFrontendBundleFile } from "~/.server/storage/gameFrontendBundle";
import {
  getEffectiveGameIDEDomain,
  getGameBundleOrigin,
} from "../shared/gameId";

function getContentType(filePath: string) {
  const extension = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
  switch (extension) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "application/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
}

function injectBaseHREFIfHTML(content: Uint8Array): Uint8Array {
  const html = new TextDecoder().decode(content);
  const lower = html.toLowerCase();
  if (!lower.includes("<html")) {
    return content;
  }
  if (lower.includes("<base ")) {
    return content;
  }

  const baseTag = `<base href="./">`;

  if (/<head(\s[^>]*)?>/i.test(html)) {
    return new TextEncoder().encode(
      html.replace(/<head(\s[^>]*)?>/i, (match) => `${match}\n    ${baseTag}`),
    );
  }

  return new TextEncoder().encode(`${baseTag}\n${html}`);
}

function getAllowedOrigin(id: string, env: Env, requestURL: URL): string {
  const origin = getGameBundleOrigin(id, env, requestURL);
  if (getEffectiveGameIDEDomain(requestURL, env) === "localhost" && requestURL.port) {
    return `${origin}:${requestURL.port}`;
  }
  return origin;
}

function applyBundleCORS(
  headers: Headers,
  request: Request,
  id: string,
  env: Env,
) {
  const allowedOrigin = getAllowedOrigin(id, env, new URL(request.url));
  const origin = request.headers.get("Origin");
  if (origin === allowedOrigin) {
    headers.set("Access-Control-Allow-Origin", allowedOrigin);
    headers.set("Vary", "Origin");
  }
}

function corsPreflightResponse(
  request: Request,
  id: string,
  env: Env,
): Response {
  const allowedOrigin = getAllowedOrigin(id, env, new URL(request.url));
  const origin = request.headers.get("Origin");
  if (origin !== allowedOrigin) {
    return new Response(null, { status: 403 });
  }

  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers":
        request.headers.get("Access-Control-Request-Headers") ?? "*",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin",
    },
  });
}

export async function handleGameBundleRequest(
  request: Request,
  env: Env,
  id: string,
): Promise<Response> {
  const game = await getGameById(env, id);
  if (!game) {
    return new Response("Game not found", { status: 404 });
  }

  if (request.method === "OPTIONS") {
    return corsPreflightResponse(request, game.id, env);
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405 });
  }

  const url = new URL(request.url);
  const requestPath = url.pathname.replace(/^\/+/, "");
  const file = await readGameFrontendBundleFile(
    env,
    game.id,
    requestPath === "" ? "" : requestPath,
  );
  if (!file) {
    return new Response("File not found", { status: 404 });
  }

  const contentType = getContentType(file.path);
  const body =
    request.method === "HEAD"
      ? null
      : contentType === "text/html; charset=utf-8"
        ? injectBaseHREFIfHTML(file.content)
        : file.content;

  const headers = new Headers({
    "content-type": contentType,
    "cache-control": "public, max-age=60",
  });
  applyBundleCORS(headers, request, game.id, env);

  return new Response(body ? Uint8Array.from(body) : null, { headers });
}
