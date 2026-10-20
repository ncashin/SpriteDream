import Move from "lucide/dist/esm/icons/move.mjs";
import Volume2 from "lucide/dist/esm/icons/volume-2.mjs";
import { css } from "remix/component";
import type { Handle } from "remix/component";

import { Icon } from "../../../icon.tsx";

export type KeyFrameType = "color" | "transform" | "sound";

const colorSwatch = css({
  width: "0.75rem",
  height: "0.75rem",
  boxSizing: "border-box",
  flex: "0 0 auto",
  borderRadius: 0,
  border: "1px solid #ffffff33",
});

export function KeyFrame(handle: Handle<{ type: KeyFrameType; value?: string }>) {
  return () => {
    switch (handle.props.type) {
      case "color":
        return <span mix={colorSwatch} style={{ background: handle.props.value }} />;
      case "transform":
        return <Icon icon={Move} size={12} />;
      case "sound":
        return <Icon icon={Volume2} size={12} />;
    }
  };
}
