import { css, type Handle } from "remix/component";

import { faceFor } from "./blobs.tsx";

type RoomDisplayProps = {
  room: {
    people: Record<string, string>;
    onMessageType(
      type: "onPersonJoin" | "onPersonLeave",
      listener: () => void,
    ): () => boolean;
  };
};

export function RoomDisplay(handle: Handle<RoomDisplayProps>) {
  const { room } = handle.props;

  const stopJoin = room.onMessageType("onPersonJoin", () => handle.update());
  const stopLeave = room.onMessageType("onPersonLeave", () => handle.update());

  handle.signal.addEventListener("abort", () => {
    stopJoin();
    stopLeave();
  });

  return () => (
    <div
      mix={css({
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        overflow: "hidden",
      })}
    >
      {Object.values(handle.props.room.people).map((id) => faceFor(id))}
    </div>
  );
}
