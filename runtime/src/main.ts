import "./style.css";
import { initializeGame } from "./runtime/initializeGame";
import { editorPlugin } from "./editor/editorPlugin";
import { render2DPlugin } from "./render2D/render2DPlugin";

initializeGame({
    plugins: [editorPlugin(), render2DPlugin()],
    main: (_context) => {
        console.log("Hello From main.ts")
    }
})