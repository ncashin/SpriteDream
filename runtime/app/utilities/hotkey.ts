export type HotkeyOptions = {
  signal?: AbortSignal;
  capture?: boolean;
  /** Run the shortcut while focus is in a text field. */
  typing?: boolean;
  /** Run the shortcut on key repeat. */
  repeat?: boolean;
  /** Extra guard checked before any binding. */
  when?: (event: KeyboardEvent) => boolean;
};

type Combo = {
  key: string;
  mod: boolean;
  shift: boolean;
  alt: boolean;
};

const MODIFIERS = new Set(["mod", "meta", "ctrl", "control", "shift", "alt"]);

export function isTyping(target: EventTarget | null) {
  if (target instanceof HTMLInputElement) return true;
  if (target instanceof HTMLTextAreaElement) return true;
  if (target instanceof HTMLSelectElement) return true;
  return target instanceof HTMLElement && target.isContentEditable;
}

export function hotkeys(
  bindings: Record<string, (event: KeyboardEvent) => void>,
  options?: HotkeyOptions,
) {
  if (typeof window === "undefined") return;

  const entries = Object.entries(bindings).flatMap(([combo, action]) =>
    combo.split(",").map((part) => [parseCombo(part), action] as const),
  );

  window.addEventListener(
    "keydown",
    (event) => {
      if (!options?.repeat && event.repeat) return;
      if (!options?.typing && isTyping(event.target)) return;
      if (options?.when && !options.when(event)) return;
      for (const [combo, action] of entries) {
        if (!matches(event, combo)) continue;
        action(event);
        return;
      }
    },
    { capture: options?.capture ?? true, signal: options?.signal },
  );
}

function parseCombo(combo: string): Combo {
  const parts = combo
    .toLowerCase()
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean);
  const key = parts.find((part) => !MODIFIERS.has(part));
  if (!key || parts.filter((part) => !MODIFIERS.has(part)).length !== 1) {
    throw new Error(`Invalid hotkey: ${combo}`);
  }
  const modifiers = new Set(parts.filter((part) => part !== key));
  return {
    key,
    mod: modifiers.has("mod") || modifiers.has("meta") || modifiers.has("ctrl") || modifiers.has("control"),
    shift: modifiers.has("shift"),
    alt: modifiers.has("alt"),
  };
}

function matches(event: KeyboardEvent, combo: Combo) {
  const key = event.key.toLowerCase();
  if (key !== combo.key && event.code.toLowerCase() !== combo.key) return false;
  if ((event.metaKey || event.ctrlKey) !== combo.mod) return false;
  if (event.shiftKey !== combo.shift) return false;
  if (event.altKey !== combo.alt) return false;
  return true;
}
