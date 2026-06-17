export const ROOM_MESSAGE = {
  ready: "ready",
  roomPeersUpdate: "roomPeersUpdate",
  signal: "signal",
} as const;

export type WebRTCSignalPayload =
  | { type: "offer"; sdp: RTCSessionDescriptionInit }
  | { type: "answer"; sdp: RTCSessionDescriptionInit }
  | { type: "ice"; candidate: RTCIceCandidateInit | null };

export type RoomReadyMessage = {
  type: typeof ROOM_MESSAGE.ready;
  peerId: string;
  peers: string[];
};

export type RoomPeersUpdateMessage = {
  type: typeof ROOM_MESSAGE.roomPeersUpdate;
  peers: string[];
};

export type RoomSignalMessage = {
  type: typeof ROOM_MESSAGE.signal;
  to: string;
  from?: string;
  payload: WebRTCSignalPayload;
};

export type RoomServerMessage =
  | RoomReadyMessage
  | RoomPeersUpdateMessage
  | (RoomSignalMessage & { from: string });

export type RoomClientMessage = RoomSignalMessage;

export function isRoomSignalMessage(message: unknown): message is RoomSignalMessage {
  if (message == null || typeof message !== "object") return false;
  const record = message as Record<string, unknown>;
  return record.type === ROOM_MESSAGE.signal && typeof record.to === "string";
}

export function isRoomPeersUpdateMessage(
  message: unknown,
): message is RoomPeersUpdateMessage {
  if (message == null || typeof message !== "object") return false;
  const record = message as Record<string, unknown>;
  return (
    record.type === ROOM_MESSAGE.roomPeersUpdate &&
    Array.isArray(record.peers) &&
    record.peers.every((id): id is string => typeof id === "string")
  );
}
