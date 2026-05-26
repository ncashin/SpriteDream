import typescriptLogo from "../template/assets/typescript.svg?raw";
import viteLogo from "../template/assets/vite.svg?raw";
import gitignore from "../template/.gitignore?raw";
import indexHtml from "../template/index.html?raw";
import packageJson from "../template/package.json?raw";
import gameUi from "../template/source/GameUI.tsx?raw";
import editor from "../template/source/Editor.tsx?raw";
import game from "../template/source/game.ts?raw";
import runtimeIndex from "../template/source/index.ts?raw";
import bouncyBallScene from "../template/source/scenes/bouncyBall.scene?raw";
import exampleScene from "../template/source/scenes/example.scene?raw";
import playerScene from "../template/source/scenes/player.scene?raw";
import style from "../template/source/style.css?raw";
import tsconfig from "../template/tsconfig.json?raw";
import viteConfig from "../template/vite.config.ts?raw";

export const templateFiles: Record<string, string> = {
  ".gitignore": gitignore,
  "assets/typescript.svg": typescriptLogo,
  "assets/vite.svg": viteLogo,
  "index.html": indexHtml,
  "package.json": packageJson,
  "source/GameUI.tsx": gameUi,
  "source/Editor.tsx": editor,
  "source/game.ts": game,
  "source/index.ts": runtimeIndex,
  "source/scenes/bouncyBall.scene": bouncyBallScene,
  "source/scenes/example.scene": exampleScene,
  "source/scenes/player.scene": playerScene,
  "source/style.css": style,
  "tsconfig.json": tsconfig,
  "vite.config.ts": viteConfig,
};
