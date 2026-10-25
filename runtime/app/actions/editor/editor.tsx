import { clientEntry, css } from "remix/component";
import { on, type Handle } from "remix/component";

import { parse } from "remix/data-schema";

import { routes } from "../../routes.ts";
import { joinRoom, type Room } from "../../room/room.tsx";
import { createHotkey } from "../../utilities/hotkey.ts";
import { projectFiles } from "./routes.ts";
import { FileViewer } from "./file-viewer.tsx";
import type { OpenFile } from "./file-viewer.tsx";
import { Search } from "./search.tsx";
import { faceFor } from "./ui/blobs.tsx";
import { lightText, treeRow } from "./styles.tsx";

import { Icon } from "../../icon.tsx";
import Park from "lucide/dist/esm/icons/park.mjs";
import Plus from "lucide/dist/esm/icons/plus.mjs";

export const Editor = clientEntry(
  import.meta.url,
  function Editor(handle: Handle) {
    let room: Room;
    let files: string[] = [];

    let openFiles: OpenFile[] = [];
    let selectedTab: OpenFile | undefined;

    async function openFile(path: string) {
      const existing = openFiles.find((tab) => tab.path === path);
      if (existing) {
        selectedTab = existing;
        handle.update();
        return;
      }

      const response = await fetch(routes.editor.file.href({ filePath: path }));
      if (!response.ok) return;
      const name = path.split("/").pop() ?? path;
      const type = response.headers.get("content-type") ?? "";
      const file: OpenFile = {
        path,
        file: new File([await response.arrayBuffer()], name, { type }),
        dirtyFlag: false,
      };
      openFiles.push(file);
      selectedTab = file;
      handle.update();
    }

    async function save(file: OpenFile) {
      const response = await fetch(
        routes.editor.saveFile.href({ filePath: file.path }),
        {
          method: "PUT",
          body: file.file,
          headers: { "content-type": file.file.type || "application/octet-stream" },
        },
      );

      if (!response.ok) return;
      file.dirtyFlag = false;
      handle.update();
    }

    createHotkey(
      {
        "mod+s": () => {
          if(!selectedTab) return;
          save(selectedTab);
        },
      },
      { signal: handle.signal, allowWhileTyping: true },
    );

    handle.queueTask(async () => {
      if (handle.signal.aborted) return;

      room = await joinRoom(handle.signal);

      room.onPersonJoin(() => {
        handle.update();
      });

      room.onPersonLeave(() => {
        handle.update();
      });

      let response = await fetch(routes.editor.listFiles.href());
      files = parse(projectFiles, await response.json());

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
                void openFile(file);
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
              gap: "0.25rem",
            })}
          >
            {openFiles.map((tab) => (
              <button
                aria-current={selectedTab === tab ? "true" : undefined}
                mix={[
                  treeRow,
                  css({
                    width: "auto",
                    flex: "0 0 auto",
                    minHeight: "min-content",
                    paddingRight: "0.5rem",
                    "&[aria-current='true']": {
                      fontVariationSettings: '"GRAD" 400',
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
                {tab.dirtyFlag ? `${tab.path} •` : tab.path}
              </button>
            ))}
            <button
              type="button"
              aria-label="Open File"
              mix={[
                treeRow,
                lightText,
                css({
                  width: "auto",
                  flex: "0 0 auto",
                  minHeight: "min-content",
                  paddingRight: "0.375rem",
                }),
              ]}
            >
              Open File
              <Icon icon={Plus} />
            </button>
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
              <div
                mix={css({
                  position: "absolute",
                  inset: 0,
                })}
              >
                <FileViewer
                  key={selectedTab.path}
                  file={selectedTab}
                  room={room}
                  onEdit={() => handle.update()}
                />
              </div>
            )}
          </div>
        </div>
      );
    };
  },
);
