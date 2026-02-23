import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import invariant from "tiny-invariant";

import { Editor } from "./Editor";
import type { Plugin } from "../runtime/plugin";

export const editorPlugin = (): Plugin => (context) => {
  const app = document.getElementById("app");
  invariant(app);
  const root = createRoot(app);
  flushSync(() => {
    root.render(createElement(Editor));
  });
  return { ...context, __isEditor: true };
};
