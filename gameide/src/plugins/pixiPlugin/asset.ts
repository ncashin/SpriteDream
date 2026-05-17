import { Assets, type Texture } from "pixi.js";

/** Matches runtime vite: project files served under `/assets/<path>`. */
export const DEFAULT_ASSET_BASE_URL = "/assets";

function normalizeProjectPath(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const noLeadingSlash = trimmed
    .replace(/^\/+/, "")
    .replace(/^\.\/+/, "");
  if (noLeadingSlash.includes("..")) {
    throw new Error(`Invalid asset path (path traversal): ${raw}`);
  }
  // URLs are `/assets/<path>` where <path> is relative to the project's assets folder.
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
  if (!base.startsWith("/") && !/^https?:\/\//i.test(base)) {
    return `${stripTrailingSlash("/" + base)}/${normalized}`;
  }
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

export async function loadGraphicTexture(
  asset: string,
  options?: { assetBaseURL?: string },
): Promise<Texture> {
  const resolved = resolveAssetURL(asset, options?.assetBaseURL);
  if (!resolved) {
    throw new Error("loadGraphicTexture: empty asset");
  }
  return Assets.load<Texture>(resolved);
}

export function unloadGraphicTextures(
  assetURLOrURLs: string | readonly string[],
): Promise<void> {
  return Assets.unload(assetURLOrURLs as string | string[]);
}
