import { readGameFrontendBundleFile } from "~/.server/storage/gameFrontendBundle";

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

export async function loader({
  params,
  context,
}: {
  params: { gameId?: string; "*": string | undefined };
  context: { cloudflare: { env: Env } };
}) {
  if (!params.gameId) {
    throw new Response("Game not found", { status: 404 });
  }

  const file = await readGameFrontendBundleFile(
    context.cloudflare.env,
    params.gameId,
    params["*"] ?? "",
  );
  if (!file) {
    throw new Response("File not found", { status: 404 });
  }

  const contentType = getContentType(file.path);
  const body =
    contentType === "text/html; charset=utf-8"
      ? injectBaseHREFIfHTML(file.content)
      : file.content;

  const responseBody = Uint8Array.from(body);

  return new Response(responseBody, {
    headers: {
      "content-type": contentType,
      "cache-control": "public, max-age=60",
    },
  });
}
