import { css } from "remix/component";
import type { Handle } from "remix/component";

import { Button } from "./button.tsx";

export function Settings(handle: Handle) {
  return () => (
    <Button size="field" label="Settings" mix={settingsButton}>
      Settings
    </Button>
  );
}

const settingsButton = css({
  background: "var(--hover)",
  backdropFilter: "blur(12px)",
  borderRadius: "6px",
  fontWeight: 450,
  marginLeft: 0,
  padding: "0.25em 0.65em",
});
