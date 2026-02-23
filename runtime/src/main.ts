import "./style.css";
import { initializeGame } from "./runtime/initializeGame";
import { editorPlugin } from "./editor/editorPlugin";
import { examplePlugin } from "./runtime/plugin";

initializeGame({
    plugins: [editorPlugin(), examplePlugin()],
    main: (context) => {
        context.example.greet();
        console.log("Hello From main.ts")
    }
})