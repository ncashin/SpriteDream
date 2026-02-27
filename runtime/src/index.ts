import "./style.css";
import { createRoot } from "react-dom/client";
import { createElement } from "react";
import { Editor } from "./editor/Editor";
import invariant from "tiny-invariant";

const app = document.getElementById("app");
invariant(app);
const root = createRoot(app);
root.render(createElement(Editor));
