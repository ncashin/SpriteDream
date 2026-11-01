import { css, on, type Handle } from "remix/component";

import { Dropdown } from "./sceneViewer/dropdown.tsx";
import { RoomProvider } from "./room-provider.tsx";
import { blobColor } from "./ui/blobs.tsx";

export function RoomDisplay(
  handle: Handle<{
    remotes: { id: string; path: string }[];
    onOpen(path: string): void;
  }>,
) {
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
    const { remotes, onOpen } = handle.props;
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
          gap: "0.25rem",
          overflow: "visible",
        })}
      >
        {others.map((id) => {
          const remote = remotes.find((tab) => tab.id === id);
          const name = remote?.path.split("/").pop();
          return (
            <button
              key={id}
              type="button"
              title={remote ? `Open ${remote.path}` : undefined}
              aria-label={name ? `Open ${name}` : "No file selected"}
              disabled={!remote}
              mix={[
                person,
                remote &&
                  on("click", () => {
                    onOpen(remote.path);
                  }),
              ]}
            >
              <img
                src="/default.png"
                alt=""
                mix={[avatar, css({ border: `1px solid ${blobColor(id)}` })]}
              />
            </button>
          );
        })}
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

const person = css({
  display: "inline-flex",
  padding: "0.15rem",
  border: "none",
  borderRadius: 0,
  background: "transparent",
  cursor: "pointer",
  "&:disabled": {
    cursor: "default",
  },
});

const avatar = css({
  display: "block",
  flex: "0 0 auto",
  width: "1.35rem",
  height: "1.35rem",
  borderRadius: "50%",
  objectFit: "cover",
});
