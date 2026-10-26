import { clientEntry, css, type Handle } from "remix/component";

import { union } from "remix/data-schema";

import { gameMessage } from "../../../game/protocol.ts";
import { joinRoom } from "../../room/room.tsx";
import { createFileSession, type FileSession } from "./file-session.ts";
import { editorMessage } from "./protocol.ts";
import type { SceneRoom } from "./scene-viewer.tsx";
import { createHotkey } from "../../utilities/hotkey.ts";
import { FileViewer, type EditorTab } from "./file-viewer.tsx";
import { Search } from "./search.tsx";
import { FileTab } from "./ui/FileTab.tsx";
import { RoomDisplay } from "./ui/room-display.tsx";
import { lightText, treeRow } from "./styles.tsx";

import { Icon } from "../../icon.tsx";
import Plus from "lucide/dist/esm/icons/plus.mjs";

export const Editor = clientEntry(
  import.meta.url,
  function Editor(handle: Handle) {
    let room: SceneRoom;
    let fileSession: FileSession;
    const viewing: Record<string, { path: string; dirty: boolean }> = {};

    let announced = false;

    function publishViewing() {
      if (!room) return;

      const path = selectedTab?.path;
      if (path) {
        announced = true;
        room.send({
          messageType: "viewing",
          path,
          dirty: selectedTab?.sharedFile.dirty,
        });
        return;
      }

      if (!announced) return;
      announced = false;
      room.send({ messageType: "viewing", path: undefined, dirty: undefined });
    }

    function viewersFor(path: string) {
      if (!room) return [];

      const ids: string[] = [];
      for (const id of Object.keys(viewing)) {
        if (viewing[id]?.path === path && room.people[id]) ids.push(id);
      }
      return ids;
    }

    handle.queueTask(async () => {
      if (handle.signal.aborted) return;

      room = await joinRoom(handle.signal, union([gameMessage, editorMessage]));
      if (handle.signal.aborted) return;
      fileSession = createFileSession(room, handle.signal);
      handle.signal.addEventListener(
        "abort",
        fileSession.subscribeFileList(() => handle.update()),
      );

      room.onMessageType("onPersonJoin", (message) => {
        if (message.id !== room.you.id) publishViewing();
        handle.update();
      });

      room.onMessageType("onPersonLeave", (message) => {
        delete viewing[message.id];
        handle.update();
      });

      room.onMessageType("viewing", (message) => {
        if (message.sentBy === room.you.id) return;

        if (message.path) {
          viewing[message.sentBy] = { path: message.path, dirty: message.dirty === true };
        } else delete viewing[message.sentBy];

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
        publishViewing();
      }

      handle.update();
    }

    function selectTab(tab: EditorTab) {
      if (selectedTab === tab) return;
      selectedTab = tab;
      publishViewing();
      handle.update();
    }

    async function openFile(path: string) {
      if (!fileSession) return;

      const existing = tabs.find((tab) => tab.path === path);
      if (existing) {
        selectTab(existing);
        return;
      }

      const sharedFile = await fileSession.open(path);
      if (!sharedFile || handle.signal.aborted) return;
      const already = tabs.find((tab) => tab.path === path);
      if (already) {
        selectTab(already);
        return;
      }
      const unsubscribe = fileSession.subscribeFile(path, () => handle.update());
      handle.signal.addEventListener("abort", unsubscribe);

      const tab: EditorTab = {
        path,
        sharedFile,
        unsubscribe,
      };

      tabs.push(tab);
      selectedTab = tab;
      publishViewing();
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

    function remoteTabs(openTabs: EditorTab[]) {
      const byPath = new Map<string, { path: string; dirty: boolean; viewers: string[] }>();

      for (const [id, view] of Object.entries(viewing)) {
        if (!room?.people[id]) continue;
        if (openTabs.some((tab) => tab.path === view.path)) continue;

        const info = byPath.get(view.path) ?? {
          path: view.path,
          viewers: [],
          dirty: false,
        };
        info.viewers.push(id);
        if (view.dirty) info.dirty = true;
        byPath.set(view.path, info);
      }

      return [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path));
    }

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
            <RoomDisplay room={room} />
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
              <FileTab
                key={tab.path}
                tab={{ path: tab.path, dirty: tab.sharedFile.dirty }}
                selected={selectedTab === tab}
                viewers={viewersFor(tab.path)}
                onClick={() => selectTab(tab)}
                onClose={() => closeFile(tab)}
              />
            ))}
            {remoteTabs(tabs).map((tab) => (
              <FileTab
                key={tab.path}
                tab={tab}
                viewers={tab.viewers}
                onClick={() => {
                  void openFile(tab.path);
                }}
              />
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
