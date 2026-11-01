import { css, on } from "remix/component";
import type { Handle } from "remix/component";
import type * as Y from "yjs";

import { FileSessionProvider } from "./file-session-provider.tsx";

export function CodeViewer(
  handle: Handle<{
    path: string;
    text: Y.Text;
    onEdit?: () => void;
  }>,
) {
  const { path, text, onEdit } = handle.props;
  const session = handle.context.get(FileSessionProvider);
  const unsubscribe = session.subscribeFile(path, () => handle.update());
  handle.signal.addEventListener("abort", unsubscribe);

  return () => (
    <textarea
      spellCheck={false}
      value={text.toString()}
      mix={[
        css({
          boxSizing: "border-box",
          border: "none",
          background: "transparent",
          color: "inherit",
          font: "inherit",
          height: "100%",
          margin: 0,
          outline: "none",
          overflow: "auto",
          padding: "1rem",
          resize: "none",
          whiteSpace: "pre",
          width: "100%",
        }),
        on("input", (event) => {
          session.write(path, event.currentTarget.value);
          onEdit?.();
          handle.update();
        }),
      ]}
    />
  );
}
