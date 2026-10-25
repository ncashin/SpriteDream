import { clientEntry, css } from "remix/component";
import { on, type Handle } from "remix/component";

import { parse } from "remix/data-schema";

import { routes } from "../../routes.ts";
import { getRoom, type Room } from "../../room/room-module.ts";
import { projectFiles } from "./routes.ts";
import { faceFor } from "./ui/blobs.tsx";
import { treeRow } from "./styles.tsx";
import { Icon } from "../../icon.tsx";
import { File } from "lucide";

export const Editor = clientEntry(
  import.meta.url,
  function Editor(handle: Handle) {
    let room: Room;
    let files: string[] = [];

    let tabs: string[] = [];
    let selectedTab: string | undefined;

    handle.queueTask(async () => {
      if (handle.signal.aborted) return;

      room = await getRoom();

      room.onPersonJoin(() => {
        handle.update();
      });

      room.onPersonLeave(() => {
        handle.update();
      });

      let response = await fetch(routes.editor.listFiles.href());
      files = parse(projectFiles, await response.json()).filter((filePath) =>
        filePath.endsWith(".json"),
      );

      handle.update();
    });

    return () => {
      if (!room || !files) return <p role="status">Loading…</p>;

      return (
        <div
          mix={[
            css({
              display: "flex",
              flexDirection: "column",
              height: "100vh",
              overflow: "hidden",
            }),
          ]}
        >
          <header
            mix={[
              css({
                display: "flex",
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                overflow: "hidden",
                width: "full",
                padding: "1rem 1rem",
              }),
            ]}
          >
            <span>Left</span>
            <span>Search</span>
            <div
              mix={[
                css({
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  overflow: "hidden",
                }),
              ]}
            >
              {Object.values(room.people).map((person) => faceFor(person.id))}
            </div>
          </header>

          <div
            mix={css({
              display: "flex",
              flexDirection: "row",
              overflow: "auto",
            })}
          >
            <div
              mix={[
                css({
                  width: "24rem",
                  display: "flex",
                  flexDirection: "column",
                  overflow: "auto",
                  padding: "1rem",
                }),
              ]}
            >
              {files.map((file) => (
                <button
                  mix={[
                    treeRow,
                    on("click", () => {
                      tabs.push(file);
                      handle.update();
                    }),
                  ]}
                >
                  <Icon icon={File} />
                  {file}
                </button>
              ))}
            </div>

            <div
              mix={[
                css({
                  display: "flex",
                  flexDirection: "column",
                  overflow: "auto",
                  height: "min",
                }),
              ]}
            >
              <div
                mix={[
                  css({
                    display: "flex",
                    flexDirection: "row",
                    overflow: "auto",
                    padding: "1rem",
                    height: "min",
                  }),
                ]}
              >
                {tabs.map((tab) => (
                  <button
                    aria-current={selectedTab === tab && "true"}
                    mix={[
                      treeRow,
                      on("click", () => {
                        if (selectedTab === tab) return;
                        selectedTab = tab;
                        handle.update();
                      }),
                    ]}
                  >
                    <Icon icon={File} />
                    {tab}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    };
  },
);
