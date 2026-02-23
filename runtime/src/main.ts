import "./style.css";
import "./root";
import { initializeGame } from "./runtime/initializeGame";
import { examplePlugin } from "./runtime/plugin";

initializeGame({
    plugins: [examplePlugin],
    main: (context) => {
        context.example.greet();
        console.log("Hello From main.ts")
    }
})