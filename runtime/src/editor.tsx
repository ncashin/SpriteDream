import { createRoot } from "react-dom/client";
import invariant from "tiny-invariant";
import EditorRoot from "./EditorRoot";
import { createEditorStore } from "./createEditorStore";
import { createIFrameTransport } from "./createIFrameTransport";

const rootElement = document.getElementById("app");
invariant(rootElement);

const editorStore = await createEditorStore({ transport: createIFrameTransport() });

const editorRoot = createRoot(rootElement);
editorRoot.render(<EditorRoot editorStore={editorStore} />);
