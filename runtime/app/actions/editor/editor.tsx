import { clientEntry, css } from "remix/component";
import { on, type Handle } from "remix/component";

import { union } from "remix/data-schema";

import { gameMessage } from "../../../game/protocol.ts";
import { joinRoom } from "../../room/room.tsx";
import { createFileSession, type FileSession } from "./file-session.ts";
import { editorMessage } from "./protocol.ts";
import type { SceneRoom } from "./scene-viewer.tsx";
import { createHotkey } from "../../utilities/hotkey.ts";
import { FileViewer, type EditorTab } from "./file-viewer.tsx";
import { Search } from "./search.tsx";
import { faceFor } from "./ui/blobs.tsx";
import { lightText, treeRow } from "./styles.tsx";

import { Icon } from "../../icon.tsx";
import Circle from "lucide/dist/esm/icons/circle.mjs";
import Park from "lucide/dist/esm/icons/park.mjs";
import Plus from "lucide/dist/esm/icons/plus.mjs";
import X from "lucide/dist/esm/icons/x.mjs";

export const Editor = clientEntry(
  import.meta.url,
  function Editor(handle: Handle) {
    let room: SceneRoom;
    let fileSession: FileSession;

    handle.queueTask(async () => {
      if (handle.signal.aborted) return;

      room = await joinRoom(handle.signal, union([gameMessage, editorMessage]));
      if (handle.signal.aborted) return;
      fileSession = createFileSession(room, handle.signal);
      handle.signal.addEventListener(
        "abort",
        fileSession.subscribeFiles(() => handle.update()),
      );

      room.onMessageType("onPersonJoin", () => {
        handle.update();
      });

      room.onMessageType("onPersonLeave", () => {
        handle.update();
      });

      handle.update();
    });

    let tabs: EditorTab[] = [];
    let selectedTab: EditorTab | undefined;

    function closeFile(tab: EditorTab) {
      const index = tabs.indexOf(tab);
      if (index === -1) return;

      tab.unsubscribe();
      tabs.splice(index, 1);

      if (selectedTab === tab) {
        selectedTab = tabs[index] ?? tabs[index - 1];
      }

      handle.update();
    }

    async function openFile(path: string) {
      if (!fileSession) return;

      // Tab already exists select
      const existing = tabs.find((tab) => tab.path === path);
      if (existing) {
        selectedTab = existing;
        handle.update();
        return;
      }

      // if not open from session
      const sharedFile = await fileSession.open(path);
      if (!sharedFile || handle.signal.aborted) return;
      const already = tabs.find((tab) => tab.path === path);
      if (already) {
        selectedTab = already;
        handle.update();
        return;
      }
      const unsubscribe = fileSession.subscribe(path, () => handle.update());
      handle.signal.addEventListener("abort", unsubscribe);

      const tab: EditorTab = {
        path,
        sharedFile,
        unsubscribe,
      };

      tabs.push(tab);
      selectedTab = tab;
      
      handle.update();
    }

    createHotkey(
      {
        "mod+s": () => {
          if (!selectedTab) return;
          fileSession.save(selectedTab.path);
        },
      },
      { signal: handle.signal, allowWhileTyping: true },
    );

    return () => {
      if (!room || !fileSession) return <p role="status">Loading…</p>;

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
              items={fileSession.files()}
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
              {Object.values(room.people).map((id) => faceFor(id))}
            </div>
          </header>

          <div
            role="tablist"
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
            {tabs.map((tab) => (
              <div
                role="tab"
                tabIndex={0}
                aria-selected={selectedTab === tab}
                aria-current={selectedTab === tab ? "true" : undefined}
                data-dirty={tab.sharedFile.dirty ? "" : undefined}
                mix={[
                  treeRow,
                  tabStyle,
                  on("click", () => {
                    if (selectedTab === tab) return;
                    selectedTab = tab;
                    handle.update();
                  }),
                  on("keydown", (event) => {
                    if (event.target !== event.currentTarget) return;
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    if (selectedTab === tab) return;
                    selectedTab = tab;
                    handle.update();
                  }),
                ]}
              >
                <Icon icon={Park} />
                {tab.path}
                <button
                  type="button"
                  aria-label={`Close ${tab.path}`}
                  mix={[
                    tabClose,
                    on("click", (event) => {
                      event.stopPropagation();
                      closeFile(tab);
                    }),
                  ]}
                >
                  <span>
                    <Icon icon={X} />
                  </span>
                  {tab.sharedFile.dirty ? (
                    <span>
                      <Icon icon={Circle} />
                    </span>
                  ) : null}
                </button>
              </div>
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
                  session={fileSession}
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

const tabStyle = css({
  width: "auto",
  flex: "0 0 auto",
  minHeight: "min-content",
  paddingRight: "0.25rem",
  "&[aria-current='true']": {
    fontVariationSettings: '"GRAD" 400',
  },
  "&[data-dirty] > button": {
    visibility: "visible",
  },
});

const tabClose = css({
  display: "inline-grid",
  placeItems: "center",
  flex: "0 0 auto",
  width: "1.25rem",
  height: "1.25rem",
  margin: 0,
  padding: 0,
  border: "none",
  borderRadius: "4px",
  background: "transparent",
  color: "inherit",
  font: "inherit",
  lineHeight: 0,
  cursor: "pointer",
  "& > span": {
    gridArea: "1 / 1",
    display: "none",
  },
  "& > span:first-child": {
    display: "inline-flex",
  },
  "[data-dirty] > & > span:first-child": {
    display: "none",
  },
  "[data-dirty] > & > span:last-child": {
    display: "inline-flex",
  },
  "[data-dirty]:hover > & > span:first-child, [data-dirty]:focus-within > & > span:first-child": {
    display: "inline-flex",
  },
  "[data-dirty]:hover > & > span:last-child, [data-dirty]:focus-within > & > span:last-child": {
    display: "none",
  },
  "[data-dirty] > & > span:last-child svg": {
    fill: "currentColor",
    stroke: "none",
    transform: "scale(0.45)",
  },
  "&:hover": {
    backgroundColor: "var(--hover)",
  },
});
