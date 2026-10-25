import { clientEntry, css, Frame } from "remix/component";
import type { Handle } from "remix/component";
import { routes } from "../../routes.ts";

import { getRoom, type Room } from "../../room/room-module.ts";

export const Editor = clientEntry(
  import.meta.url,
  function Editor(handle: Handle) {
    let room: Room | undefined;

    handle.queueTask(async () => {
      if (handle.signal.aborted) return;

      room = await getRoom();

      room.onPersonJoin(() => {
        handle.update();
      });

      room.onPersonLeave(() => {
        handle.update();
      });
      
      handle.update();
    });

    return () => {
      if (!room) return <p role="status">Loading…</p>;

      return (
        <div
          mix={[
            css({
              display: "flex",
              height: "100vh",
              overflow: "hidden",
            }),
          ]}
        >
          <div
            mix={[
              css({
                display: "flex",
                direction: "row",
                height: "100vh",
                overflow: "hidden",
              }),
            ]}
          >
            {Object.values(room.people).map((person) => (
              <span>{person.id}</span>
            ))}
          </div>
        </div>
      );
    };
  },
);
