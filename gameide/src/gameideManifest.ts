import manifest from "virtual:gameide-manifest";

export type GameIDEMetadata = {
  id?: string;
  name?: string;
  version?: string;
  description?: string;
};

/** Values from the project root `gameide.json` (provided by `gameidePlugin`). */
export function getGameIDEMetadata(): GameIDEMetadata {
  return manifest;
}

const DEFAULT_SIGNALING_ORIGIN = "https://gameide.app";

/**
 * Builds the hosted game’s WebRTC signaling URL.
 * When `metadata` is omitted, uses {@link getGameIDEMetadata} (manifest from `gameide.json`).
 */
export function getGameIDESignalingURL(
  metadata?: GameIDEMetadata,
  origin: string = DEFAULT_SIGNALING_ORIGIN
): string {
  const m = metadata ?? getGameIDEMetadata();
  const id = m.id;
  if (!id) {
    throw new Error(
      'gameide.json must include "id" (your game UUID from gameide.app).'
    );
  }
  const base = origin.replace(/\/$/, "");
  return `${base}/game/${id}/webrtc-signal`;
}
