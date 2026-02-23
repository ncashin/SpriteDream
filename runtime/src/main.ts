import "./style.css";
import { initializeGame } from "./runtime/initializeGame";
import { editorPlugin } from "./editor/editorPlugin";
import { examplePlugin } from "./runtime/plugin";

initializeGame({
    plugins: [editorPlugin()],
    main: (context) => {
        console.log("Hello From main.ts")
    }
})