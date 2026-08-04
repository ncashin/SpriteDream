import { createRoot } from "react-dom/client";
import invariant from "tiny-invariant";
import EditorRoot from "./EditorRoot";

const rootElement = document.getElementById("app");
invariant(rootElement);

const editorRoot = createRoot(rootElement);
editorRoot.render(<EditorRoot />);
