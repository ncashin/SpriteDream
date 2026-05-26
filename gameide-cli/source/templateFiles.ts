import logo from "../template/assets/logo.svg?raw";
import gameideJson from "../template/gameide.json?raw";
import indexHtml from "../template/index.html?raw";
import packageJson from "../template/package.json?raw";
import gameUi from "../template/source/GameUI.tsx?raw";
import editor from "../template/source/Editor.tsx?raw";
import game from "../template/source/game.ts?raw";
import runtimeIndex from "../template/source/index.ts?raw";
import mainScene from "../template/source/scenes/main.scene?raw";
import style from "../template/source/style.css?raw";
import tsconfig from "../template/tsconfig.json?raw";
import viteConfig from "../template/vite.config.ts?raw";

export const templateFiles: Record<string, string> = {
  "assets/logo.svg": logo,
  "gameide.json": gameideJson,
  "index.html": indexHtml,
  "package.json": packageJson,
  "source/GameUI.tsx": gameUi,
  "source/Editor.tsx": editor,
  "source/game.ts": game,
  "source/index.ts": runtimeIndex,
  "source/scenes/main.scene": mainScene,
  "source/style.css": style,
  "tsconfig.json": tsconfig,
  "vite.config.ts": viteConfig,
};
