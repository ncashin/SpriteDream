import { clientEntry, css, on } from "remix/component";
import type { Handle } from "remix/component";

export const Panel = clientEntry(import.meta.url, function Panel(handle: Handle) {
  let count = 0;

  return () => (
    <section
      mix={[
        css({
          boxSizing: "border-box",
          width: "100%",
          height: "100%",
          margin: 0,
          padding: "12px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          background: "#18181b",
          color: "#f4f4f5",
          font: "14px system-ui, sans-serif",
        }),
      ]}
    >
      <p mix={[css({ margin: 0 })]}>Pressed {count} times</p>
      <button
        type="button"
        mix={[
          css({
            alignSelf: "start",
            padding: "6px 10px",
            border: "1px solid #3f3f46",
            borderRadius: "6px",
            background: "#27272a",
            color: "inherit",
            cursor: "pointer",
          }),
          on("click", () => {
            count += 1;
            handle.update();
          }),
        ]}
      >
        Press
      </button>
    </section>
  );
});
