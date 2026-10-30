import { clientEntry, css, on, type Handle } from "remix/component";

import { routes } from "../../routes.ts";

declare global {
  interface Window {
    spriteDream: {
      openFolder(): Promise<string | null>;
    };
  }
}

export const Welcome = clientEntry(import.meta.url, function Welcome(_handle: Handle) {
  async function openFolder() {
    const directory = await window.spriteDream.openFolder();
    if (!directory) return;

    window.location.assign(routes.editor.index.href({ project: directory }));
  }

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
          css({
            padding: "0.55rem 0.75rem",
            border: 0,
            borderRadius: "0.4rem",
            background: "transparent",
            color: "inherit",
            font: "inherit",
            cursor: "pointer",
            ":hover": { background: "var(--hover)" },
          }),
        ]}
      >
        Open Folder
      </button>
    </main>
  );
});
