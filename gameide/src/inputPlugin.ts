import { definePlugin } from "./plugin.js";
import { gameUpdate } from "./gameloop.js";

export type InputBinding =
  | `Key${string}`
  | `Mouse${number}`
  | `Button${number}`;

export type AxisConfig = {
  negative: InputBinding[];
  positive: InputBinding[];
};

export type ButtonConfig = InputBinding[];

export type InputPluginRequiredContext = { rootElement?: HTMLElement };
export type InputPluginOptions = {
  axes?: Record<string, AxisConfig>;
  buttons?: Record<string, ButtonConfig>;
  target?: HTMLElement | Document;
};

const DEFAULT_AXES: Record<string, AxisConfig> = {
  Horizontal: {
    negative: ["KeyA", "KeyArrowLeft"],
    positive: ["KeyD", "KeyArrowRight"],
  },
  Vertical: {
    negative: ["KeyS", "KeyArrowDown"],
    positive: ["KeyW", "KeyArrowUp"],
  },
};

const DEFAULT_BUTTONS: Record<string, ButtonConfig> = {
  Fire: ["Mouse0", "KeySpace"],
  Jump: ["KeySpace"],
  Submit: ["KeyEnter", "KeySpace"],
  Cancel: ["KeyEscape"],
};

function normalizeKey(code: string): InputBinding {
  if (code.startsWith("Key")) return code as InputBinding;
  return `Key${code}` as InputBinding;
}

export type InputContext = {
  getAxis: (axisName: string) => number;
  getButton: (buttonName: string) => boolean;
  getButtonDown: (buttonName: string) => boolean;
  getButtonUp: (buttonName: string) => boolean;
  getMouseDelta: () => { x: number; y: number };
};

export const inputPlugin = definePlugin<InputPluginOptions, InputPluginRequiredContext, { input: InputContext }>(
  (options?: InputPluginOptions) => (inputContext: InputPluginRequiredContext): InputPluginRequiredContext & { input: InputContext } => {
    const axes = { ...DEFAULT_AXES, ...options?.axes };
    const buttons = { ...DEFAULT_BUTTONS, ...options?.buttons };
    const target = options?.target ?? inputContext.rootElement ?? document;

    const keyState: Record<string, boolean> = {};
    const mouseState: Record<string, boolean> = {};
    const previousKeyState: Record<string, boolean> = {};
    const previousMouseState: Record<string, boolean> = {};

    let mouseDeltaX = 0;
    let mouseDeltaY = 0;

    function setKey(binding: InputBinding, down: boolean) {
      if (binding.startsWith("Key")) {
        keyState[binding] = down;
      }
    }

    function setMouse(button: number, down: boolean) {
      mouseState[String(button)] = down;
    }

    function isBindingDown(binding: InputBinding): boolean {
      if (binding.startsWith("Key")) return keyState[binding] ?? false;
      if (binding.startsWith("Mouse")) {
        const n = binding.slice(5);
        return mouseState[n] ?? false;
      }
      return false;
    }

    function wasBindingDown(binding: InputBinding): boolean {
      if (binding.startsWith("Key")) return previousKeyState[binding] ?? false;
      if (binding.startsWith("Mouse")) {
        const n = binding.slice(5);
        return previousMouseState[n] ?? false;
      }
      return false;
    }

    target.addEventListener("keydown", (e: Event) => {
      const ev = e as KeyboardEvent;
      setKey(normalizeKey(ev.code), true);
      ev.preventDefault();
    });
    target.addEventListener("keyup", (e: Event) => {
      const ev = e as KeyboardEvent;
      setKey(normalizeKey(ev.code), false);
      ev.preventDefault();
    });
    target.addEventListener("mousedown", (e: Event) => {
      const ev = e as MouseEvent;
      setMouse(ev.button, true);
      ev.preventDefault();
    });
    target.addEventListener("mouseup", (e: Event) => {
      const ev = e as MouseEvent;
      setMouse(ev.button, false);
      ev.preventDefault();
    });
    target.addEventListener("mousemove", (e: Event) => {
      const ev = e as MouseEvent;
      mouseDeltaX += ev.movementX;
      mouseDeltaY += ev.movementY;
    });

    gameUpdate(() => {
      Object.assign(previousKeyState, keyState);
      Object.assign(previousMouseState, mouseState);
      mouseDeltaX = 0;
      mouseDeltaY = 0;
    });

    function getAxis(axisName: string) {
      const config = axes[axisName];
      if (!config) return 0;
      let value = 0;
      for (const b of config.negative) if (isBindingDown(b)) value -= 1;
      for (const b of config.positive) if (isBindingDown(b)) value += 1;
      return Math.max(-1, Math.min(1, value));
    }

    function getButton(buttonName: string) {
      const bindings = buttons[buttonName];
      if (!bindings) return false;
      return bindings.some((b) => isBindingDown(b));
    }

    function getButtonDown(buttonName: string) {
      const bindings = buttons[buttonName];
      if (!bindings) return false;
      return bindings.some((b) => isBindingDown(b) && !wasBindingDown(b));
    }

    function getButtonUp(buttonName: string) {
      const bindings = buttons[buttonName];
      if (!bindings) return false;
      return bindings.some((b) => !isBindingDown(b) && wasBindingDown(b));
    }

    function getMouseDelta() {
      return { x: mouseDeltaX, y: mouseDeltaY };
    }

    const input: InputContext = {
      getAxis,
      getButton,
      getButtonDown,
      getButtonUp,
      getMouseDelta,
    };

    return { ...inputContext, input };
  }
);
