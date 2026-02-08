import type { Route } from "./+types/api.runtime.$";
import { readFileSync } from "fs";
import { join } from "path";
import { existsSync } from "fs";

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

export async function loader({ params, request }: Route.LoaderArgs) {
  const path = params["*"] || "";
  
  // Get the runtime dist directory
  // In production, this will be copied to the build directory
  // In development, we'll use the relative path
  const runtimeDistPath = process.env.NODE_ENV === 'production'
    ? join(process.cwd(), 'runtime', 'dist')
    : join(process.cwd(), '..', 'runtime', 'dist');
  
  // Normalize the path
  let filePath = path;
  if (!filePath || filePath === '/') {
    filePath = 'index.html';
  } else {
    filePath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
  }
  
  const fullPath = join(runtimeDistPath, filePath);
  
  // Security: ensure we're not accessing files outside the dist directory
  if (!fullPath.startsWith(runtimeDistPath)) {
    throw new Response("Invalid path", { status: 400 });
  }
  
  if (!existsSync(fullPath)) {
    throw new Response("File not found", { status: 404 });
  }
  
  const fileData = readFileSync(fullPath);
  const mimeType = getMimeType(filePath);
  
  // If serving HTML, inject base tag for proper path resolution
  if (mimeType === 'text/html') {
    const htmlContent = fileData.toString('utf-8');
    let modifiedHtml = htmlContent;
    
    // Base path should point to the runtime route
    const basePath = `/api/runtime/`;
    
    // Always remove any existing base tags first
    const baseTagRegex = /<base\s+[^>]*>/gi;
    modifiedHtml = modifiedHtml.replace(baseTagRegex, '');
    
    // Add base tag at the beginning of <head>
    const baseTag = `<base href="${basePath}">`;
    if (modifiedHtml.includes('<head>')) {
      modifiedHtml = modifiedHtml.replace('<head>', `<head>\n  ${baseTag}`);
    } else if (modifiedHtml.includes('<head ')) {
      modifiedHtml = modifiedHtml.replace(/<head\s+[^>]*>/, (match) => `${match}\n  ${baseTag}`);
    } else {
      modifiedHtml = `${baseTag}\n${modifiedHtml}`;
    }
    
    return new Response(modifiedHtml, {
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  }
  
  // For assets (JS, CSS, etc.), use longer cache but with proper headers
  const isAsset = filePath.startsWith('assets/');
  const cacheControl = isAsset 
    ? "public, max-age=31536000, immutable"
    : "public, max-age=3600";
  
  return new Response(fileData, {
    headers: {
      "Content-Type": mimeType,
      "Cache-Control": cacheControl,
    },
  });
}

