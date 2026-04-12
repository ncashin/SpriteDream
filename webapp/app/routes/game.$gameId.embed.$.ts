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

function injectBaseHREFIfHTML(content: Uint8Array | Buffer): Buffer {
  const html = Buffer.from(content).toString("utf8");
  const lower = html.toLowerCase();
  if (!lower.includes("<html")) {
    return Buffer.from(content);
  }
  if (lower.includes("<base ")) {
    return Buffer.from(content);
  }

  const baseTag = `<base href="./">`;

  if (/<head(\s[^>]*)?>/i.test(html)) {
    return Buffer.from(
      html.replace(/<head(\s[^>]*)?>/i, (match) => `${match}\n    ${baseTag}`),
      "utf8",
    );
  }

  return Buffer.from(`${baseTag}\n${html}`, "utf8");
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

  const contentType = getContentType(file.absolutePath);
  const content: Buffer =
    contentType === "text/html; charset=utf-8"
      ? injectBaseHREFIfHTML(file.content)
      : Buffer.from(file.content);
  const body = new Uint8Array(content);

  return new Response(body, {
    headers: {
      "content-type": contentType,
      "cache-control": "public, max-age=60",
    },
  });
}
