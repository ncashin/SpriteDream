import type { Plugin } from "vite";
import fs from "node:fs";

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

function parseSceneJson(raw: string): JsonValue {
  return JSON.parse(raw) as JsonValue;
}

function createSceneModuleCode(data: JsonValue): string {
  return `const data = ${JSON.stringify(data)};
export default data;
`;
}

export function gameidePlugin(): Plugin {
  return {
    name: "gameide-plugin",
    load(id: string) {
      const cleanId = id.replace(/\?.*$/, "");
      if (!cleanId.endsWith(".scene")) return;

      const raw = fs.readFileSync(cleanId, "utf8");
      const data = parseSceneJson(raw);
      return createSceneModuleCode(data);
    },
  };
}
