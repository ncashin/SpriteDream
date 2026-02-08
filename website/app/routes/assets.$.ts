import { readFileSync, existsSync } from "fs";
import { join } from "path";
import type { LoaderFunctionArgs } from "react-router";

function getMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    js: "application/javascript",
    css: "text/css",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    svg: "image/svg+xml",
    ico: "image/x-icon",
    woff: "font/woff",
    woff2: "font/woff2",
    ttf: "font/ttf",
    eot: "application/vnd.ms-fontobject",
    json: "application/json",
    html: "text/html",
    txt: "text/plain",
  };
  return mimeTypes[ext || ""] || "application/octet-stream";
}

export async function loader({ params }: LoaderFunctionArgs) {
  const path = (params as { "*"?: string })["*"] || "";

  // Normalize the path
  let filePath = path;
  if (!filePath || filePath === "/") {
    throw new Response("File not found", { status: 404 });
  }

  // Remove leading slash if present
  filePath = filePath.startsWith("/") ? filePath.slice(1) : filePath;

  const clientAssetsPath = join(process.cwd(), "build", "client", "assets");
  const runtimeAssetsPath =
    process.env.NODE_ENV === "production"
      ? join(process.cwd(), "runtime", "dist", "assets")
      : join(process.cwd(), "..", "runtime", "dist", "assets");

  const candidatePaths = [
    { root: clientAssetsPath, fullPath: join(clientAssetsPath, filePath) },
    { root: runtimeAssetsPath, fullPath: join(runtimeAssetsPath, filePath) },
  ];

  const assetEntry = candidatePaths.find(({ root, fullPath }) => {
    if (!fullPath.startsWith(root)) return false;
    return existsSync(fullPath);
  });

  if (!assetEntry) {
    throw new Response("File not found", { status: 404 });
  }

  const fileData = readFileSync(assetEntry.fullPath);
  const mimeType = getMimeType(filePath);

  return new Response(fileData, {
    headers: {
      "Content-Type": mimeType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

