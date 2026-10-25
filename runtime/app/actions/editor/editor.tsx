import { clientEntry, css } from "remix/component";
import { on, type Handle } from "remix/component";

import { parse } from "remix/data-schema";

import { routes } from "../../routes.ts";
import { getRoom, type Room } from "../../room/room-module.ts";
import { createHotkey } from "../../utilities/hotkey.ts";
import { projectFiles } from "./routes.ts";
import { FileViewer, fileBody, fileUnsaved } from "./file-viewer.tsx";
import type { OpenFile } from "./file-viewer.tsx";
import { Search } from "./search.tsx";
import { faceFor } from "./ui/blobs.tsx";
import { lightText, treeRow } from "./styles.tsx";

const dirtyMark = css({
  color: "color-mix(in srgb, var(--text) 55%, transparent)",
  fontSize: "11px",
  fontWeight: 450,
});

const dirtyMarkHidden = css({
  display: "none",
});
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

      const response = await fetch(routes.editor.file.href({ filePath: path }), {
        headers: { accept: "text/plain" },
      });
      if (!response.ok) return;
      const text = await response.text();
      const file: OpenFile = { path, saved: text, text };
      if (path.endsWith(".scene")) {
        file.scene = JSON.parse(text);
        file.saved = JSON.stringify(file.scene);
      }
      openFiles.push(file);
      selectedTab = file;
      handle.update();
    }

    async function save(file: OpenFile | undefined) {
      if (!file) return;
      const response = await fetch(routes.editor.saveFile.href({ filePath: file.path }), {
        method: "PUT",
        body: fileBody(file),
        headers: { "content-type": "text/plain;charset=utf-8" },
      });
      if (!response.ok) return;
      file.saved = file.scene ? JSON.stringify(file.scene) : file.text;
      handle.update();
    }

    createHotkey(
      {
        "mod+s": () => {
          void save(selectedTab);
        },
      },
      { signal: handle.signal, allowWhileTyping: true },
    );

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
                {tab.path}
                <span
                  aria-hidden={fileUnsaved(tab) ? undefined : true}
                  mix={[dirtyMark, !fileUnsaved(tab) && dirtyMarkHidden]}
                >
                  Unsaved
                </span>
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
            {openFiles.map((tab) => (
              <div
                key={tab.path}
                mix={css({
                  position: "absolute",
                  inset: 0,
                  visibility: selectedTab === tab ? "visible" : "hidden",
                  pointerEvents: selectedTab === tab ? "auto" : "none",
                })}
              >
                <FileViewer file={tab} onEdit={() => handle.update()} />
              </div>
            ))}
          </div>
        </div>
      );
    };
  },
);
