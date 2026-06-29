import { createFilter } from "vite";

const EXPORT_DEFAULT_NAMED_FUNCTION =
  /export\s+default\s+(async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/;

const GAME_MODULE_INJECTED = /__gameide(?:Curried)?GameModule\s*\(/;
const GAMEIDE_GAME_MODULE_COMMENT = /@gameide-game-module/;
const CURRIED_RETURN = /:\s*GameModule\s*</;

const DEFAULT_DIRECT_INCLUDE = ["**/game.ts"];
const DEFAULT_CURRIED_INCLUDE = [
  "**/*GameModule.ts",
  "**/gameide/gameModules/**/*GameModule.ts",
];

type GameModuleHMRMode = "direct" | "curried";

function isCurriedGameModuleExport(code: string): boolean {
  if (CURRIED_RETURN.test(code)) return true;
  const match = EXPORT_DEFAULT_NAMED_FUNCTION.exec(code);
  if (!match) return false;

  const afterExport = code.slice(match.index);
  return /\breturn\s+(async\s+)?(\([^)]*\)\s*=>|function\b)/.test(
    afterExport,
  );
}

function detectGameModuleHMRMode(
  code: string,
  id: string,
  directFilter: ReturnType<typeof createFilter>,
  curriedFilter: ReturnType<typeof createFilter>,
): GameModuleHMRMode | null {
  if (GAME_MODULE_INJECTED.test(code)) return null;

  const match = EXPORT_DEFAULT_NAMED_FUNCTION.exec(code);
  if (!match) return null;

  const curried = isCurriedGameModuleExport(code);
  if (GAMEIDE_GAME_MODULE_COMMENT.test(code)) {
    return curried ? "curried" : "direct";
  }
  if (curried && (curriedFilter(id) || directFilter(id))) return "curried";
  if (!curried && directFilter(id)) return "direct";
  return null;
}

function insertImport(code: string, importLine: string): string {
  const leadingMatch =
    /^(?:\s*\/\/[^\n]*\n|\s*\/\*[\s\S]*?\*\/\s*)*/.exec(code);
  const insertPos = leadingMatch?.[0].length ?? 0;
  return code.slice(0, insertPos) + importLine + code.slice(insertPos);
}

function hoistDefaultExport(code: string, match: RegExpExecArray): string {
  const exportIndex = match.index;
  return (
    code.slice(0, exportIndex) +
    code.slice(exportIndex + "export default ".length)
  );
}

function appendHMRBlock(
  code: string,
  mode: GameModuleHMRMode,
  functionName: string,
): string {
  if (mode === "curried") {
    return (
      code +
      `\nexport default __gameideCurriedGameModule(import.meta.url, ${functionName});\n` +
      `if (import.meta.hot) {\n` +
      `  import.meta.hot.accept(() => {\n` +
      `    void __gameideRerunCurriedGameModule(import.meta.url, ${functionName});\n` +
      `  });\n` +
      `}\n`
    );
  }

  return (
    code +
    `\nexport default __gameideGameModule(import.meta.url, ${functionName});\n` +
    `if (import.meta.hot) {\n` +
    `  import.meta.hot.accept(() => {\n` +
    `    void __gameideRerunGameModule(import.meta.url, ${functionName});\n` +
    `  });\n` +
    `}\n`
  );
}

function transformGameModuleSource(
  code: string,
  mode: GameModuleHMRMode,
): string | null {
  const match = EXPORT_DEFAULT_NAMED_FUNCTION.exec(code);
  if (!match) return null;

  const functionName = match[2]!;
  let transformed = hoistDefaultExport(code, match);

  const importLine =
    mode === "curried"
      ? `import { curriedGameModule as __gameideCurriedGameModule, rerunCurriedGameModule as __gameideRerunCurriedGameModule } from "gameide";\n`
      : `import { gameModule as __gameideGameModule, rerunGameModule as __gameideRerunGameModule } from "gameide";\n`;

  transformed = insertImport(transformed, importLine);
  transformed = appendHMRBlock(transformed, mode, functionName);

  return transformed;
}

const directFilter = createFilter(DEFAULT_DIRECT_INCLUDE);
const curriedFilter = createFilter(DEFAULT_CURRIED_INCLUDE);

export function transformGameModuleForHMR(
  code: string,
  id: string,
  isServe: boolean,
) {
  if (!isServe) return;

  const mode = detectGameModuleHMRMode(code, id, directFilter, curriedFilter);
  if (!mode) return;

  const transformed = transformGameModuleSource(code, mode);
  if (!transformed) return;

  return { code: transformed, map: null };
}
