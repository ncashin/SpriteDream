import { clientEntry, css, type Handle } from "remix/component";
import { union } from "remix/data-schema";

import { gameMessage } from "../../../game/protocol.ts";
import { editorMessage } from "./protocol.ts";

import { createHotkey } from "../../utilities/hotkey.ts";
import { FileViewer } from "./file-viewer.tsx";
import { FileSessionProvider } from "./file-session-provider.tsx";
import { Search } from "./search.tsx";
import { FileTab } from "./FileTab.tsx";
import { AgentEdits } from "./agent-edits.tsx";
import { RoomDisplay } from "./room-display.tsx";
import { RoomProvider } from "./room-provider.tsx";
import type { SharedFile } from "./file-session.ts";

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
          <EditorWorkspace project={handle.props.project} />
        </FileSessionProvider>
      </RoomProvider>
    );
  },
);

export type EditorTab = {
  path: string;
  sharedFile: SharedFile;
};
export type RemoteEditorTab = {
  id: string;
  path: string;
  dirty: boolean;
};

function EditorWorkspace(handle: Handle<{ project: string }>) {
  const { room } = handle.context.get(RoomProvider);
  const fileSession = handle.context.get(FileSessionProvider);

  let openTabs: EditorTab[] = [];
  let selectedTab: EditorTab | undefined;

  let remoteSelectedTabs: RemoteEditorTab[] = [];

  function broadcastSelectedTab() {
    if (selectedTab) {
      room.send({
        messageType: "selectedTab",
        path: selectedTab.path,
        dirty: selectedTab.sharedFile.dirty,
      });
      return;
    }

    room.send({
      messageType: "selectedTab",
      path: undefined,
      dirty: undefined,
    });
  }

  handle.signal.addEventListener(
    "abort",
    fileSession.subscribeFileList(() => handle.update()),
  );

  // TODO: Make this broadcast only to new person
  room.onMessageType("onPersonJoin", () => {
    if (!selectedTab) return;
    broadcastSelectedTab();
  });
  room.onMessageType("onPersonLeave", (message) => {
    const index = remoteSelectedTabs.findIndex((tab) => tab.id === message.id);
    if (index !== -1) remoteSelectedTabs.splice(index, 1);
    handle.update();
  });

  room.onMessageType("selectedTab", (message) => {
    const index = remoteSelectedTabs.findIndex(
      (tab) => tab.id === message.sentBy,
    );
    if (index !== -1) remoteSelectedTabs.splice(index, 1);
    if (message.path)
      remoteSelectedTabs.push({
        id: message.sentBy,
        path: message.path,
        dirty: message.dirty === true,
      });
    handle.update();
  });
  
  async function openTab(path: string) {
    if (!fileSession) return;

    const existing = openTabs.find((tab) => tab.path === path);
    if (existing) {
      selectTab(existing);
      return;
    }

    const sharedFile = await fileSession.open(path);
    if (!sharedFile || handle.signal.aborted) return;
    const already = openTabs.find((tab) => tab.path === path);
    if (already) {
      selectTab(already);
      return;
    }
    const tab: EditorTab = {
      path,
      sharedFile,
    };

    openTabs.push(tab);
    selectedTab = tab;
    broadcastSelectedTab();
    handle.update();
  }
  function closeTab(tab: EditorTab) {
    const index = openTabs.indexOf(tab);
    if (index === -1) return;

    openTabs.splice(index, 1);

    if (selectedTab === tab) {
      selectedTab = openTabs[index] ?? openTabs[index - 1];
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

  createHotkey(
    {
      "mod+s": async () => {
        if (!selectedTab?.sharedFile.dirty) return;
        await fileSession.save(selectedTab.path);
        broadcastSelectedTab();
        handle.update();
      },
    },
    { signal: handle.signal, allowWhileTyping: true },
  );

  return () => (
    <div
      mix={css({
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr)",
        gridTemplateRows: "3rem minmax(0, 1fr)",
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
          height: "3rem",
          boxSizing: "border-box",
          overflow: "visible",
          gap: "0.5rem",
          padding: "0.5rem 1rem 0.5rem calc(1rem + env(titlebar-area-x, 0))",
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
          {openTabs.map((tab) => (
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
              onClose={() => closeTab(tab)}
            />
          ))}
        </div>
        <Search
          items={fileSession.files()}
          onSelect={(file) => {
            void openTab(file);
          }}
        />
        <div
          mix={css({
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            WebkitAppRegion: "no-drag",
          })}
        >
          <AgentEdits project={handle.props.project} />
          <RoomDisplay
            remotes={remoteSelectedTabs.filter((remote) => room.people[remote.id])}
            onOpen={(path) => {
              void openTab(path);
            }}
          />
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
