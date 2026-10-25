import { clientEntry, css } from "remix/component";
import { on, type Handle, Frame } from "remix/component";

import { parse } from "remix/data-schema";

import { routes } from "../../routes.ts";
import { getRoom, type Room } from "../../room/room-module.ts";
import { projectFiles } from "./routes.ts";
import { Search } from "./search.tsx";
import { faceFor } from "./ui/blobs.tsx";
import { treeRow } from "./styles.tsx";
import { Icon } from "../../icon.tsx";
import Park from "lucide/dist/esm/icons/park.mjs";

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
        filePath.endsWith(".scene"),
      );

      handle.update();
    });

    return () => {
      if (!room || !files) return <p role="status">Loading…</p>;

      return (
        <div
          mix={css({
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr)",
            gridTemplateRows: "auto auto minmax(0, 1fr)",
            gridTemplateAreas: `
              "header"
              "tabs"
              "tabContent"
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
              overflow: "visible",
              padding: "0.5rem 1rem",
            })}
          >
            <span></span>
            <Search
              items={files}
              onSelect={(file) => {
                if (!tabs.includes(file)) tabs.push(file);
                selectedTab = file;
                handle.update();
              }}
            />
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
              gridArea: "tabs",
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              minWidth: 0,
              position: "relative",
              zIndex: 1,
              overflow: "auto",
              background: "#121213",
              padding: "0rem 0rem 0.5rem 0.5rem",
              gap: "0.25rem"
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
                    paddingRight: "0.5rem",
                    "&[aria-current='true']": {
                      fontVariationSettings: '"GRAD" 150',
                    },
                  }),
                  on("click", () => {
                    if (selectedTab === tab) return;
                    selectedTab = tab;
                    handle.update();
                  }),
                ]}
              >
                <Icon icon={Park} />
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
              borderTop: "1px solid var(--line)",
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
