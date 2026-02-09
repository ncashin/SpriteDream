import type { Route } from "./+types/api.games.$id.bundle";
import { db, games } from "../db";
import { eq } from "drizzle-orm";
import AdmZip from "adm-zip";
import { URL } from "url";

// Cache for extracted bundles (in production, use a proper cache like Redis)
const bundleCache = new Map<string, Map<string, Buffer>>();

function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    'html': 'text/html',
    'js': 'application/javascript',
    'css': 'text/css',
    'json': 'application/json',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'woff': 'font/woff',
    'woff2': 'font/woff2',
    'ttf': 'font/ttf',
    'eot': 'application/vnd.ms-fontobject',
    'ico': 'image/x-icon',
    'webp': 'image/webp',
  };
  return mimeTypes[ext || ''] || 'application/octet-stream';
}

async function extractBundle(gameId: string, gameBundle: Buffer): Promise<Map<string, Buffer>> {
  // Check cache first
  if (bundleCache.has(gameId)) {
    return bundleCache.get(gameId)!;
  }

  // Extract ZIP bundle
  const zip = new AdmZip(gameBundle);
  const entries = zip.getEntries();
  const files = new Map<string, Buffer>();

  for (const entry of entries) {
    if (!entry.isDirectory) {
      // Store files with their path relative to the bundle root
      const path = entry.entryName;
      files.set(path, entry.getData());
    }
  }

  // Cache the extracted files
  bundleCache.set(gameId, files);
  return files;
}

export async function loader({ params, request }: Route.LoaderArgs) {
  const gameId = params.id;

  if (!db) {
    return new Response("Database unavailable", { status: 503 });
  }

  // Get game bundle from database
  const [game] = await db
    .select({
      name: games.name,
      gameBundle: games.gameBundle,
    })
    .from(games)
    .where(eq(games.id, gameId));

  if (!game || !game.gameBundle) {
    throw new Response("Game not found", { status: 404 });
  }

  // Extract the bundle
  const files = await extractBundle(gameId, game.gameBundle);

  // Get the requested path from the URL
  const url = new URL(request.url);
  let path = url.pathname;

  // Strip the bundle route prefix
  const bundlePrefix = `/api/games/${gameId}/bundle`;
  if (path.startsWith(bundlePrefix)) {
    path = path.slice(bundlePrefix.length);
  } else {
    throw new Response(`Invalid path: ${path}`, { status: 400 });
  }

  // Normalize path: handle root, remove leading slash
  let actualPath = path;
  if (!path || path === '/') {
    actualPath = 'dist/index.html';
  } else {
    actualPath = path.startsWith('/') ? path.slice(1) : path;
  }

  // Try to find the file - check if it already has dist/ prefix
  let fileData = files.get(actualPath);
  let resolvedPath = actualPath;
  
  // If not found and doesn't start with dist/, try with dist/ prefix
  if (!fileData && !actualPath.startsWith('dist/')) {
    fileData = files.get(`dist/${actualPath}`);
    if (fileData) {
      resolvedPath = `dist/${actualPath}`;
    }
  }
  
  // If still not found and starts with dist/, try without dist/ prefix
  if (!fileData && actualPath.startsWith('dist/')) {
    fileData = files.get(actualPath.slice(5)); // Remove 'dist/' prefix
    if (fileData) {
      resolvedPath = actualPath.slice(5);
    }
  }
  
  // If still not found, try looking for files in dist/ directory
  // This handles cases where absolute paths like /vite.svg are requested
  // or when files are referenced from the HTML (like ./assets/index.js)
  if (!fileData) {
    // Try to find it in dist/ directory
    fileData = files.get(`dist/${actualPath}`);
    if (fileData) {
      resolvedPath = `dist/${actualPath}`;
    } else {
      // Try without the leading path component (e.g., "vite.svg" instead of "dist/vite.svg")
      const filename = actualPath.split('/').pop();
      if (filename) {
        fileData = files.get(`dist/${filename}`);
        if (fileData) {
          resolvedPath = `dist/${filename}`;
        }
      }
    }
  }

  // If not found, return 404
  if (!fileData) {
    throw new Response(`File not found: ${actualPath}`, { status: 404 });
  }

  // Determine content type
  const mimeType = getMimeType(resolvedPath);

    // If serving HTML, inject base tag to ensure relative paths resolve correctly
    if (mimeType === 'text/html') {
      const htmlContent = fileData.toString('utf-8');
      let modifiedHtml = htmlContent;
      
      // Base path should point to dist/ directory where the HTML and assets are located
      // Since index.html is at dist/index.html and assets are at dist/assets/,
      // the base should be at dist/ so relative paths like ./assets/ resolve correctly
      const basePath = `/api/games/${gameId}/bundle/dist/`;
      
      // Always replace existing base tag or add new one
      // Use a more robust regex to match base tags
      const baseTagRegex = /<base\s+[^>]*href\s*=\s*["'][^"']*["'][^>]*>|<base\s+[^>]*>/gi;
      if (htmlContent.match(baseTagRegex)) {
        // Replace existing base tag(s) - reset regex lastIndex
        baseTagRegex.lastIndex = 0;
        modifiedHtml = modifiedHtml.replace(baseTagRegex, `<base href="${basePath}">`);
      } else {
        // Add new base tag
        const baseTag = `<base href="${basePath}">`;
        // Try to insert after <head> tag
        if (htmlContent.includes('<head>')) {
          modifiedHtml = htmlContent.replace('<head>', `<head>\n  ${baseTag}`);
        } else if (htmlContent.includes('<head ')) {
          // Handle <head with attributes>
          modifiedHtml = htmlContent.replace(/<head\s+[^>]*>/, (match) => `${match}\n  ${baseTag}`);
        } else {
          // Fallback: insert at the beginning
          modifiedHtml = `${baseTag}\n${htmlContent}`;
        }
      }
      
      return new Response(modifiedHtml, {
        headers: {
          "Content-Type": mimeType,
          "Cache-Control": "public, max-age=3600",
        },
      });
    }
  

  return new Response(new Uint8Array(fileData), {
    headers: {
      "Content-Type": mimeType,
      "Cache-Control": "public, max-age=3600",
    },
  });
}

