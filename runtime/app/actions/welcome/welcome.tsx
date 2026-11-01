import { clientEntry, css, on, type Handle } from "remix/component";

import { routes } from "../../routes.ts";

declare global {
  interface Window {
    spriteDream: {
      openFolder(): Promise<string | null>;
      openTestFiles(): Promise<string>;
      windowChrome(): Promise<{ trafficLights: boolean }>;
      onWindowChrome(callback: (chrome: { trafficLights: boolean }) => void): () => void;
    };
  }
}

export const Welcome = clientEntry(import.meta.url, function Welcome(_handle: Handle) {
  async function openFolder() {
    const directory = await window.spriteDream.openFolder();
    if (!directory) return;

    window.location.assign(routes.editor.index.href({ project: directory }));
  }

  async function openTestFiles() {
    const directory = await window.spriteDream.openTestFiles();
    window.location.assign(routes.editor.index.href({ project: directory }));
  }

  const buttonStyle = css({
    padding: "0.55rem 0.75rem",
    border: 0,
    borderRadius: "0.4rem",
    background: "transparent",
    color: "inherit",
    font: "inherit",
    cursor: "pointer",
    ":hover": { background: "var(--hover)" },
  });

  return () => (
    <main
      mix={css({
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1.5rem",
      })}
    >
      <h1 mix={css({ margin: 0, fontSize: "1.25rem", fontWeight: 520 })}>SpriteDream</h1>
      <button
        type="button"
        mix={[
          on("click", () => {
            void openFolder();
          }),
          buttonStyle,
        ]}
      >
        Open Folder
      </button>
      <button
        type="button"
        mix={[
          on("click", () => {
            void openTestFiles();
          }),
          buttonStyle,
        ]}
      >
        Open Test Files
      </button>
    </main>
  );
});
