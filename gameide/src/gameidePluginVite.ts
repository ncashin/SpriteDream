import type { Plugin } from "vite";

function jsonToObjectLiteral(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return String(value);
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(jsonToObjectLiteral).join(",")}]`;
  if (typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .map(
        ([k, v]) =>
          `${/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k) ? k : JSON.stringify(k)}:${jsonToObjectLiteral(v)}`
      )
      .join(",")}}`;
  }
  return "undefined";
}

export function gameidePlugin(): Plugin {
  return {
    name: "gameide-scene-to-const",
    transform(src, id) {
      if (!id.endsWith(".scene")) return;
      const literal = jsonToObjectLiteral(JSON.parse(src));
      return {
        code: `export default ${literal};`,
        map: null,
      };
    },
  };
}
