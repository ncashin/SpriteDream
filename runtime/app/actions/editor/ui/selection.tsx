import type { Handle, RemixNode } from "remix/component";

import type { Selection as SelectionApi } from "../../../utilities/selection.ts";

export function Selection(
  handle: Handle<{ value: SelectionApi; children?: RemixNode }, SelectionApi>,
) {
  handle.context.set(handle.props.value);
  return () => handle.props.children;
}
