import { clientEntry, css, on, type Handle } from "remix/component";

import type { Project } from "../../data/tables.ts";
import { routes } from "../../routes.ts";

declare global {
  interface Window {
    spriteDream: {
      openFolder(): Promise<string | null>;
    };
  }
}

export const Welcome = clientEntry(
  import.meta.url,
  function Welcome(handle: Handle<{ projects: Project[] }>) {
    async function openFolder() {
      const directory = await window.spriteDream.openFolder();
      if (!directory) return;

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
      textDecoration: "none",
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
        <ul
          mix={css({
            margin: 0,
            padding: 0,
            listStyle: "none",
            display: "flex",
            flexDirection: "column",
            alignItems: "stretch",
            minWidth: "16rem",
          })}
        >
          {handle.props.projects.map((project) => (
            <li key={project.id}>
              <button
                type="button"
                mix={[
                  on("click", () => {
                    window.location.assign(
                      routes.editor.index.href({ project: project.directory }),
                    );
                  }),
                  buttonStyle,
                ]}
              >
                {project.name}
              </button>
            </li>
          ))}
        </ul>
      </main>
    );
  },
);
