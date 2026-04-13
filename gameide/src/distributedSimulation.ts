import { SCENE_OWNER_ID } from "./sceneOwnership.js";
import { queryObject } from "./scene/query.js";
import type { SceneObject, SceneObjectData } from "./scene/scene.js";

/**
 * Helpers for **distributed simulation**: one authoritative writer per scene object
 * (`{@link SCENE_OWNER_ID}`), everyone else applies patches from the network.
 *
 * ## Who gets assigned
 * Use a **deterministic rule** so every client picks the same peer id without extra
 * messages — for example {@link electedHostPeerId} on {@link sortedSessionPeerIds}
 * (lexicographically smallest id, matching the WebRTC mesh tie-break in this repo).
 * Games can instead choose “room creator id” or “first peer in join order” as long
 * as the rule is a pure function of ids everyone knows.
 *
 * ## Handoff when a peer leaves
 * Subscribe to {@link SceneTransportWebRTC.onRemotePeersChange} (also on
 * `networking` from the networking plugin). When a peer id disappears from the
 * session set, run the same deterministic migration on every client (or only on the
 * {@link electedHostPeerId}, others wait for patches). Use
 * {@link transferSceneOwnershipFromPeer} to rewrite `__ownerId` from the departed
 * peer to the successor. After each mutation, emit rules use the **new** owner, so
 * only the successor (or host) actually sends patches; others’ local writes are
 * no-ops for replication.
 *
 * ## Cross-owner contact (two simulators interact)
 * Prefer **one writer** for the interacting region: parent both objects under a
 * shared subtree whose `__ownerId` is the **arbiter** (often the same as
 * {@link electedHostPeerId}), or move one object under the other’s subtree for the
 * duration of the interaction. Avoid two authorities mutating the same props in one
 * frame; resolve contacts in that subtree only on the arbiter’s client.
 */

/** All peers in the room (local + remotes), sorted for stable, shared decisions. */
export function sortedSessionPeerIds(
  localPeerId: string,
  remotePeerIds: readonly string[],
): string[] {
  return [...new Set([localPeerId, ...remotePeerIds])].sort();
}

/**
 * Deterministic “host” / tie-break peer: lexicographically smallest session id.
 * Matches offerer/answerer split in `createSceneTransportWebRTC`.
 */
export function electedHostPeerId(sessionPeerIds: readonly string[]): string | undefined {
  if (sessionPeerIds.length === 0) return undefined;
  return [...sessionPeerIds].sort()[0];
}

export function isSessionHost(
  localPeerId: string,
  remotePeerIds: readonly string[],
): boolean {
  const host = electedHostPeerId(sortedSessionPeerIds(localPeerId, remotePeerIds));
  return host !== undefined && host === localPeerId;
}

/**
 * After `fromPeerId` has left the mesh, pick a single successor (here: the new
 * elected host among **remaining** peers). Override in game code if you want a
 * different policy.
 */
export function successorOwnerAfterPeerLeft(
  localPeerId: string,
  remotePeerIds: readonly string[],
  leftPeerId: string,
): string | undefined {
  const remaining = sortedSessionPeerIds(localPeerId, remotePeerIds).filter(
    (id) => id !== leftPeerId,
  );
  return electedHostPeerId(remaining);
}

/**
 * Sets `{@link SCENE_OWNER_ID}` from `fromPeerId` to `toPeerId` on every scene object
 * that currently carries `fromPeerId` as owner (explicit field only).
 *
 * @returns How many objects were updated.
 */
/** Attach an explicit scene writer id (`{@link SCENE_OWNER_ID}` on the payload). */
export function withSceneOwnershipForPeer<T extends SceneObjectData>(
  ownerPeerId: string,
  data: T,
): T & { [SCENE_OWNER_ID]: string } {
  return { ...data, [SCENE_OWNER_ID]: ownerPeerId } as T & {
    [SCENE_OWNER_ID]: string;
  };
}

export function transferSceneOwnershipFromPeer(
  scene: SceneObject,
  fromPeerId: string,
  toPeerId: string,
): number {
  let count = 0;
  for (const obj of queryObject(scene, (raw): raw is SceneObjectData => {
    if (raw === null || typeof raw !== "object") return false;
    return (raw as Record<string, unknown>)[SCENE_OWNER_ID] === fromPeerId;
  })) {
    (obj as Record<string, unknown>)[SCENE_OWNER_ID] = toPeerId;
    count++;
  }
  return count;
}
