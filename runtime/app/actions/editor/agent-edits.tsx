import { css, type Handle } from "remix/component";
import { number, object, parseSafe } from "remix/data-schema";

import { routes } from "../../routes.ts";

const agentChanges = object({ count: number() });

export function AgentEdits(handle: Handle<{ project: string }>) {
  let count = 0;
  const url = routes.editor.agentChanges.href({ project: handle.props.project });

  async function refresh() {
    if (handle.signal.aborted) return;

    try {
      const response = await fetch(url);
      if (!response.ok || handle.signal.aborted) return;

      const parsed = parseSafe(agentChanges, await response.json());
      if (!parsed.success || parsed.value.count === count) return;

      count = parsed.value.count;
      handle.update();
    } catch {
      // Electron is not answering yet.
    }
  }

  const timer = setInterval(() => {
    void refresh();
  }, 2000);
  handle.signal.addEventListener("abort", () => clearInterval(timer));
  void refresh();

  return () => (
    <div title="Agent file edits since this project opened" mix={badge}>
      <img src="/icons/cursor-icon.png" alt="" mix={avatar} />
      <span>{count}</span>
    </div>
  );
}

const badge = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "0.3rem",
  color: "var(--ink)",
  fontSize: "0.75rem",
});

const avatar = css({
  display: "block",
  width: "1.35rem",
  height: "1.35rem",
  borderRadius: "20%",
  objectFit: "cover",
});
