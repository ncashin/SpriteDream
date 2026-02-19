import { createElement } from "react";
import { createRoot } from "react-dom/client";

import { Editor } from "./editor/Editor";
import invariant from "tiny-invariant";

const app = document.getElementById("app");
invariant(app);
const root = createRoot(app);

root.render(createElement(Editor));
