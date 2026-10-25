export type HotkeyOptions = {
  signal?: AbortSignal;
  capture?: boolean;
  /** Run the shortcut while focus is in a text field. */
  allowWhileTyping?: boolean;
  /** Run the shortcut on key repeat. */
  allowKeyRepeat?: boolean;
  /** Extra guard checked before any binding. */
  enabledWhen?: (event: KeyboardEvent) => boolean;
};

type Combo = {
  key: string;
  mod: boolean;
  shift: boolean;
  alt: boolean;
};

type Binding = readonly [Combo, (event: KeyboardEvent) => void];

const MODIFIER_NAMES = new Set(["mod", "meta", "ctrl", "control", "shift", "alt"]);

export function isTyping(target: EventTarget | null) {
  if (target instanceof HTMLInputElement) return true;
  if (target instanceof HTMLTextAreaElement) return true;
  if (target instanceof HTMLSelectElement) return true;
  return target instanceof HTMLElement && target.isContentEditable;
}

export function createHotkey(
  bindings: Record<string, (event: KeyboardEvent) => void>,
  options?: HotkeyOptions,
) {
  if (typeof window === "undefined") return;

  const entries = expandBindings(bindings);

  window.addEventListener("keydown", (event) => handleKeydown(event, entries, options), {
    capture: options?.capture ?? true,
    signal: options?.signal,
  });
}

function expandBindings(bindings: Record<string, (event: KeyboardEvent) => void>): Binding[] {
  const entries: Binding[] = [];

  for (const [combo, action] of Object.entries(bindings)) {
    for (const part of combo.split(",")) {
      entries.push([parseCombo(part), action]);
    }
  }

  return entries;
}

function handleKeydown(event: KeyboardEvent, entries: Binding[], options?: HotkeyOptions) {
  if (shouldIgnore(event, options)) return;

  for (const [combo, action] of entries) {
    if (!matches(event, combo)) continue;
    action(event);
    return;
  }
}

function shouldIgnore(event: KeyboardEvent, options?: HotkeyOptions) {
  if (!options?.allowKeyRepeat && event.repeat) return true;
  if (!options?.allowWhileTyping && isTyping(event.target)) return true;
  if (options?.enabledWhen && !options.enabledWhen(event)) return true;
  return false;
}

function parseCombo(combo: string): Combo {
  const parts = combo
    .toLowerCase()
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean);

  const keys = parts.filter((part) => !MODIFIER_NAMES.has(part));
  const key = keys[0];
  if (!key || keys.length !== 1) {
    throw new Error(`Invalid hotkey: ${combo}`);
  }

  const modifiers = new Set(parts.filter((part) => part !== key));

  return {
    key,
    mod: wantsMod(modifiers),
    shift: modifiers.has("shift"),
    alt: modifiers.has("alt"),
  };
}

function wantsMod(modifiers: Set<string>) {
  return (
    modifiers.has("mod") ||
    modifiers.has("meta") ||
    modifiers.has("ctrl") ||
    modifiers.has("control")
  );
}

function matches(event: KeyboardEvent, combo: Combo) {
  if (!sameKey(event, combo.key)) return false;
  if (pressedMod(event) !== combo.mod) return false;
  if (event.shiftKey !== combo.shift) return false;
  if (event.altKey !== combo.alt) return false;
  return true;
}

function sameKey(event: KeyboardEvent, key: string) {
  return event.key.toLowerCase() === key || event.code.toLowerCase() === key;
}

function pressedMod(event: KeyboardEvent) {
  return event.metaKey || event.ctrlKey;
}
