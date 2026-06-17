import { Assets, type Texture } from "pixi.js";
import { getDevicePixelRatio } from "./displayMetrics.js";

/** Matches runtime vite: project files served from the built `assets/` directory. */
export const DEFAULT_ASSET_BASE_URL = "assets";

function normalizeProjectPath(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const noLeadingSlash = trimmed
    .replace(/^\/+/, "")
    .replace(/^\.\/+/, "");
  if (noLeadingSlash.includes("..")) {
    throw new Error(`Invalid asset path (path traversal): ${raw}`);
  }
  // URLs are `assets/<path>` where <path> is relative to the project's assets folder.
  // Strip a redundant `assets/` prefix when the scene stores repo-style paths (e.g. `assets/vite.svg`).
  return noLeadingSlash.replace(/^assets\/+/i, "");
}

function stripTrailingSlash(path: string): string {
  return path.replace(/\/+$/, "");
}

export function isAbsoluteAssetURL(reference: string): boolean {
  const trimmedReference = reference.trim();
  return (
    /^https?:\/\//i.test(trimmedReference) ||
    trimmedReference.startsWith("data:") ||
    trimmedReference.startsWith("blob:") ||
    trimmedReference.startsWith("/")
  );
}

export function assetURL(
  projectRelativePath: string,
  assetBaseURL: string = DEFAULT_ASSET_BASE_URL,
): string {
  const normalized = normalizeProjectPath(projectRelativePath);
  if (!normalized) {
    throw new Error("assetURL: empty path");
  }
  const base = stripTrailingSlash(
    assetBaseURL.trim() || DEFAULT_ASSET_BASE_URL,
  );
  return `${base}/${normalized}`;
}

export function resolveAssetURL(
  asset: string,
  assetBaseURL: string = DEFAULT_ASSET_BASE_URL,
): string {
  const trimmedAsset = asset.trim();
  if (!trimmedAsset) return "";
  if (isAbsoluteAssetURL(trimmedAsset)) return trimmedAsset;
  return assetURL(trimmedAsset, assetBaseURL);
}

function positiveFiniteNumberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : fallback;
}

export function isSVGAsset(asset: string): boolean {
  const trimmed = asset.trim().toLowerCase();
  return (
    trimmed.endsWith(".svg") ||
    trimmed.startsWith("data:image/svg+xml")
  );
}

export async function loadGraphicTexture(
  asset: string | undefined,
  options?: {
    assetBaseURL?: string;
    displaySize?: { width?: number; height?: number };
  },
): Promise<Texture | undefined> {
  const trimmedAsset = asset?.trim() ?? "";
  if (!trimmedAsset) return undefined;

  const resolved = resolveAssetURL(trimmedAsset, options?.assetBaseURL);
  if (!resolved) return undefined;

  try {
    if (isSVGAsset(trimmedAsset)) {
      const width = positiveFiniteNumberOr(options?.displaySize?.width, 1);
      const height = positiveFiniteNumberOr(options?.displaySize?.height, 1);
      const resolution = getDevicePixelRatio();
      const cacheKey = `${resolved}#w=${width}&h=${height}&dpr=${resolution}`;
      return await Assets.load<Texture>({
        alias: cacheKey,
        src: resolved,
        data: { width, height, resolution },
      });
    }

    return await Assets.load<Texture>(resolved);
  } catch {
    return undefined;
  }
}

export function unloadGraphicTextures(
  assetURLOrURLs: string | readonly string[],
): Promise<void> {
  return Assets.unload(assetURLOrURLs as string | string[]);
}
