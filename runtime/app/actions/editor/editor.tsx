import { clientEntry, css, type Handle } from "remix/component";
import { union } from "remix/data-schema";

import { gameMessage } from "../../../game/protocol.ts";
import { editorMessage } from "./protocol.ts";

import { createHotkey } from "../../utilities/hotkey.ts";
import { FileViewer, type EditorTab } from "./file-viewer.tsx";
import { FileSessionProvider } from "./file-session-provider.tsx";
import { Search } from "./search.tsx";
import { FileTab } from "./FileTab.tsx";
import { RoomDisplay } from "./room-display.tsx";
import { RoomProvider } from "./room-provider.tsx";

export const Editor = clientEntry(
  import.meta.url,
  function Editor(handle: Handle<{ project: string; roomURL?: string }>) {
    return () => (
      <RoomProvider
        roomName={handle.props.project}
        roomURL={handle.props.roomURL}
        protocol={union([gameMessage, editorMessage])}
      >
        <FileSessionProvider>
          <EditorWorkspace />
        </FileSessionProvider>
      </RoomProvider>
    );
  },
);

function EditorWorkspace(handle: Handle) {
  const { room } = handle.context.get(RoomProvider);
  const fileSession = handle.context.get(FileSessionProvider);
  
  let remoteSelectedTabs: { id: string; path: string; dirty: boolean }[] = [];

  function broadcastSelectedTab() {
    if (selectedTab) {
      room.send({
        messageType: "selectedTab",
        path: selectedTab.path,
        dirty: selectedTab.sharedFile.dirty,
      });
      return;
    }

    room.send({ messageType: "selectedTab", path: undefined, dirty: undefined });
  }

  let tabs: EditorTab[] = [];
  let selectedTab: EditorTab | undefined;

  handle.signal.addEventListener("abort", fileSession.subscribeFileList(() => handle.update()));

  room.onMessageType("onPersonJoin", (message) => {
    if (message.id !== room.you.id && selectedTab) broadcastSelectedTab();
    handle.update();
  });
  room.onMessageType("onPersonLeave", (message) => {
    const index = remoteSelectedTabs.findIndex((tab) => tab.id === message.id);
    if (index !== -1) remoteSelectedTabs.splice(index, 1);
    handle.update();
  });

  room.onMessageType("selectedTab", (message) => {
    if (message.sentBy === room.you.id) return;

    const index = remoteSelectedTabs.findIndex((tab) => tab.id === message.sentBy);
    if (index !== -1) remoteSelectedTabs.splice(index, 1);
    if (message.path)
      remoteSelectedTabs.push({
        id: message.sentBy,
        path: message.path,
        dirty: message.dirty === true,
      });
    handle.update();
  });
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
      const tab: EditorTab = {
        path,
        sharedFile,
      };

      tabs.push(tab);
      selectedTab = tab;
      broadcastSelectedTab();
      handle.update();
    }
    function closeFile(tab: EditorTab) {
      const index = tabs.indexOf(tab);
      if (index === -1) return;

      tabs.splice(index, 1);

      if (selectedTab === tab) {
        selectedTab = tabs[index] ?? tabs[index - 1];
        broadcastSelectedTab();
      }

      handle.update();
    }
    function selectTab(tab: EditorTab) {
      if (selectedTab === tab) return;
      selectedTab = tab;
      broadcastSelectedTab();
      handle.update();
    }

    let trafficLights = false;
    if (typeof window !== "undefined" && window.spriteDream?.windowChrome) {
      void window.spriteDream.windowChrome().then((chrome) => {
        trafficLights = chrome.trafficLights;
        handle.update();
      });
      const stopChrome = window.spriteDream.onWindowChrome((chrome) => {
        trafficLights = chrome.trafficLights;
        handle.update();
      });
      handle.signal.addEventListener("abort", stopChrome);
    }

    createHotkey(
      {
        "mod+s": () => {
          if (!selectedTab?.sharedFile.dirty) return;
          void fileSession.save(selectedTab.path).then(() => {
            broadcastSelectedTab();
            handle.update();
          });
        },
      },
      { signal: handle.signal, allowWhileTyping: true },
    );

    return () => (
      <div
          mix={css({
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr)",
            gridTemplateRows: "auto minmax(0, 1fr)",
            gridTemplateAreas: `
              "header"
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
              position: "relative",
              justifyContent: "space-between",
              alignItems: "center",
              overflow: "visible",
              gap: "0.5rem",
              padding: trafficLights ? "0.5rem 1rem 0.5rem 5.25rem" : "0.5rem 1rem",
              WebkitAppRegion: "drag",
            })}
          >
            <div
              role="tablist"
              mix={css({
                display: "flex",
                flex: "1 1 auto",
                flexDirection: "row",
                alignItems: "center",
                minWidth: 0,
                overflow: "auto",
                gap: "0.25rem",
                WebkitAppRegion: "no-drag",
              })}
            >
            {tabs.map((tab) => (
              <FileTab
                key={tab.path}
                tab={{ path: tab.path, dirty: tab.sharedFile.dirty }}
                selected={selectedTab === tab}
                viewers={remoteSelectedTabs
                  .filter(
                    (remote) =>
                      remote.path === tab.path && room.people[remote.id],
                  )
                  .map((remote) => remote.id)}
                onClick={() => selectTab(tab)}
                onClose={() => closeFile(tab)}
              />
            ))}
            {remoteSelectedTabs
              .filter(
                (remote) =>
                  room.people[remote.id] &&
                  !tabs.some((tab) => tab.path === remote.path),
              )
              .map((remote) => (
                <FileTab
                  key={remote.id}
                  tab={{ path: remote.path, dirty: remote.dirty }}
                  onClick={() => {
                    void openFile(remote.path);
                  }}
                />
              ))}
            </div>
            <Search
              items={fileSession.files()}
              onSelect={(file) => {
                void openFile(file);
              }}
            />
            <div mix={css({ display: "flex", alignItems: "center", gap: "0.5rem", WebkitAppRegion: "no-drag" })}>
              <RoomDisplay />
            </div>
          </header>
          <div
            mix={css({
              gridArea: "tabContent",
              minWidth: 0,
              minHeight: 0,
              padding: "0 0.5rem 0.5rem",
            })}
          >
            <div
              mix={css({
                position: "relative",
                height: "100%",
                overflow: "hidden",
                isolation: "isolate",
                borderRadius: "0.625rem",
                backgroundColor: "var(--menu)",
                border: "1px solid var(--line)",
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
                  onEdit={() => {
                    handle.update();
                    broadcastSelectedTab();
                  }}
                />
              </div>
            )}
            </div>
          </div>
      </div>
    );
}
