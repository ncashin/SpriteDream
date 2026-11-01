import { css, type Handle } from "remix/component";

import { Dropdown } from "./sceneViewer/dropdown.tsx";
import { RoomProvider } from "./room-provider.tsx";

export function RoomDisplay(handle: Handle) {
  const roomState = handle.context.get(RoomProvider);
  const { room } = roomState;

  const stopJoin = room.onMessageType("onPersonJoin", () => handle.update());
  const stopLeave = room.onMessageType("onPersonLeave", () => handle.update());

  handle.signal.addEventListener("abort", () => {
    stopJoin();
    stopLeave();
  });

  return () => {
    const { production, canUseProduction, toggleProduction } = roomState;
    const others = Object.values(room.people).filter((id) => id !== room.you.id);
    const hint = canUseProduction
      ? production
        ? "Using production room"
        : "Using local room"
      : "Set ROOM_URL in runtime/.env to use the production room";

    return (
      <div
        mix={css({
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          overflow: "visible",
        })}
      >
        {others.map((id) => (
          <img key={id} src="/default.png" alt="" mix={avatar} />
        ))}
        <Dropdown
          label={hint}
          searchable={false}
          items={[
            {
              label: production ? "Local" : "Prod",
              onSelect() {
                if (!production && !canUseProduction) return;
                toggleProduction();
              },
            },
          ]}
        >
          <img src="/default.png" alt="" mix={avatar} />
        </Dropdown>
      </div>
    );
  };
}

const avatar = css({
  display: "block",
  flex: "0 0 auto",
  width: "1.35rem",
  height: "1.35rem",
  borderRadius: "50%",
  objectFit: "cover",
});
