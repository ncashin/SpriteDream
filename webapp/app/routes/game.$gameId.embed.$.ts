import path from "node:path";

import { readGameFrontendBundleFile } from "~/.server/storage/gameFrontendBundle";

function getContentType(filePath: string) {
  switch (path.extname(filePath).toLowerCase()) {
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

export async function loader({
  params,
}: {
  params: { gameId?: string; "*": string | undefined };
}) {
  if (!params.gameId) {
    throw new Response("Game not found", { status: 404 });
  }

  const file = await readGameFrontendBundleFile(params.gameId, params["*"] ?? "");
  if (!file) {
    throw new Response("File not found", { status: 404 });
  }

  return new Response(file.content, {
    headers: {
      "content-type": getContentType(file.absolutePath),
      "cache-control": "public, max-age=60",
    },
  });
}
