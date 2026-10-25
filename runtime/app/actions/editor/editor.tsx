import { clientEntry, css } from "remix/component";
import { on, type Handle, Frame } from "remix/component";

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
          mix={css({
            display: "grid",
            gridTemplateColumns: "24rem minmax(0, 1fr)",
            gridTemplateRows: "auto auto minmax(0, 1fr)",
            gridTemplateAreas: `
              "header header"
              "files tabs"
              "files tabContent"
            `,
            height: "100vh",
            overflow: "hidden",
          })}
        >
          <header
            mix={css({
              gridArea: "header",
              display: "flex",
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              overflow: "hidden",
              padding: "1rem",
            })}
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
              gridArea: "files",
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
              overflow: "auto",
              padding: "1rem",
            })}
          >
            {files.map((file) => (
              <button
                mix={[
                  treeRow,
                  on("click", () => {
                    if (!tabs.includes(file)) tabs.push(file);
                    selectedTab = file;
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
            mix={css({
              gridArea: "tabs",
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              minWidth: 0,
              position: "relative",
              zIndex: 1,
              overflow: "auto",
              padding: "1rem",
              background: "#121213",
              gap: "0.35rem",
            })}
          >
            {tabs.map((tab) => (
              <button
                aria-current={selectedTab === tab && "true"}
                mix={[
                  treeRow,
                  css({
                    width: "auto",
                    flex: "0 0 auto",
                    minHeight: "min-content",
                  }),
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
          <div
            mix={css({
              gridArea: "tabContent",
              position: "relative",
              minWidth: 0,
              minHeight: 0,
              overflow: "hidden",
              isolation: "isolate",
            })}
          >
            {selectedTab && (
              <Frame src={routes.editor.file.href({ filePath: selectedTab })} />
            )}
          </div>
        </div>
      );
    };
  },
);
