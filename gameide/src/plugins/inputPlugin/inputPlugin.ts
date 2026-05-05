import { update } from "../../lifecycle/gameloop.js";
import type { Plugin } from "../../lifecycle/plugin.js";

export type InputBinding =
  | `Key${string}`
  | `Mouse${number}`
  | `Button${number}`;

export type AxisConfig = {
  negative: InputBinding[];
  positive: InputBinding[];
};

export type ButtonConfig = InputBinding[];

export type InputPluginRequiredContext = { rootElement: HTMLElement };
export type InputPluginOptions = {
  axes: Record<string, AxisConfig>;
  buttons: Record<string, ButtonConfig>;
  target?: HTMLElement | Document;
  dragCursor?: {
    buttons: number[];
    down: string;
    dragging: string;
    idle?: string;
  };
};

type AxisKeys<Options extends InputPluginOptions> = keyof Options["axes"] &
  string;
type ButtonKeys<Options extends InputPluginOptions> = keyof Options["buttons"] &
  string;

type InputShape<Options extends InputPluginOptions> = {
  axes: { [K in keyof Options["axes"] & string]: number };
  buttons: {
    [K in keyof Options["buttons"] & string]: {
      held: boolean;
      pressed: boolean;
      released: boolean;
    };
  };
  mouse: {
    delta: { x: number; y: number };
    position: { x: number; y: number } | null;
  };
};

function normalizeKey(code: string): InputBinding {
  if (code.startsWith("Key")) return code as InputBinding;
  return `Key${code}` as InputBinding;
}

export function inputPlugin<Options extends InputPluginOptions>(
  options: Options,
): Plugin<InputPluginRequiredContext, { input: InputShape<Options> }> {
  return (inputContext) => {
    const axesConfig = options.axes;
    const buttonsConfig = options.buttons;
    const target = options.target ?? inputContext.rootElement ?? document;

    if (target instanceof HTMLElement) target.tabIndex = 0;

    const cursorTarget = target instanceof HTMLElement ? target : null;
    const dragCursorConfig = options.dragCursor;
    const originalInlineCursor = cursorTarget ? cursorTarget.style.cursor : "";
    let dragCursorActive = false;

    const keyState: Record<string, boolean> = {};
    const mouseState: Record<string, boolean> = {};
    const previousKeyState: Record<string, boolean> = {};
    const previousMouseState: Record<string, boolean> = {};

    let mouseDeltaX = 0;
    let mouseDeltaY = 0;
    let mouseX = 0;
    let mouseY = 0;
    let hasMousePosition = false;

    const axisKeys = Object.keys(axesConfig) as AxisKeys<Options>[];
    const buttonKeys = Object.keys(buttonsConfig) as ButtonKeys<Options>[];

    const axes = Object.fromEntries(
      axisKeys.map((k) => [k, 0]),
    ) as InputShape<Options>["axes"];

    const buttons = Object.fromEntries(
      buttonKeys.map((k) => [
        k,
        { held: false, pressed: false, released: false },
      ]),
    ) as InputShape<Options>["buttons"];

    const mouse = {
      delta: { x: 0, y: 0 },
      position: null as { x: number; y: number } | null,
    };

    function setKey(binding: InputBinding, down: boolean) {
      if (binding.startsWith("Key")) {
        keyState[binding] = down;
      }
    }

    function setMouse(button: number, down: boolean) {
      mouseState[String(button)] = down;
    }

    function isBindingDown(binding: string): boolean {
      if (binding.startsWith("Key")) return keyState[binding] ?? false;
      if (binding.startsWith("Mouse")) {
        const n = binding.slice(5);
        return mouseState[n] ?? false;
      }
      return false;
    }

    function wasBindingDown(binding: string): boolean {
      if (binding.startsWith("Key"))
        return previousKeyState[binding] ?? false;
      if (binding.startsWith("Mouse")) {
        const n = binding.slice(5);
        return previousMouseState[n] ?? false;
      }
      return false;
    }

    function axisValue(axisName: AxisKeys<Options>): number {
      const config = axesConfig[axisName];
      if (!config) return 0;
      let value = 0;
      for (const b of config.negative) if (isBindingDown(b)) value -= 1;
      for (const b of config.positive) if (isBindingDown(b)) value += 1;
      return Math.max(-1, Math.min(1, value));
    }

    function buttonHeld(buttonName: ButtonKeys<Options>): boolean {
      const bindings = buttonsConfig[buttonName];
      if (!bindings) return false;
      return bindings.some((b) => isBindingDown(b));
    }

    function buttonPressed(buttonName: ButtonKeys<Options>): boolean {
      const bindings = buttonsConfig[buttonName];
      if (!bindings) return false;
      return bindings.some((b) => isBindingDown(b) && !wasBindingDown(b));
    }

    function buttonReleased(buttonName: ButtonKeys<Options>): boolean {
      const bindings = buttonsConfig[buttonName];
      if (!bindings) return false;
      return bindings.some((b) => !isBindingDown(b) && wasBindingDown(b));
    }

    target.addEventListener("keydown", (e) => {
      const ev = e as KeyboardEvent;
      setKey(normalizeKey(ev.code), true);
      ev.preventDefault();
    });
    target.addEventListener("keyup", (e) => {
      const ev = e as KeyboardEvent;
      setKey(normalizeKey(ev.code), false);
      ev.preventDefault();
    });
    target.addEventListener("mousedown", (e) => {
      const ev = e as MouseEvent;
      if (target instanceof HTMLElement) target.focus();

      if (
        cursorTarget &&
        dragCursorConfig &&
        dragCursorConfig.buttons.includes(ev.button)
      ) {
        dragCursorActive = true;
        cursorTarget.style.cursor = dragCursorConfig.down;
      }

      mouseX = ev.clientX;
      mouseY = ev.clientY;
      hasMousePosition = true;
      setMouse(ev.button, true);
      ev.preventDefault();
    });
    target.addEventListener("mouseup", (e) => {
      const ev = e as MouseEvent;

      if (
        cursorTarget &&
        dragCursorConfig &&
        dragCursorConfig.buttons.includes(ev.button)
      ) {
        dragCursorActive = false;
        cursorTarget.style.cursor =
          dragCursorConfig.idle ?? originalInlineCursor;
      }

      mouseX = ev.clientX;
      mouseY = ev.clientY;
      hasMousePosition = true;
      setMouse(ev.button, false);
      ev.preventDefault();
    });
    target.addEventListener("mousemove", (e) => {
      const ev = e as MouseEvent;
      mouseDeltaX += ev.movementX;
      mouseDeltaY += ev.movementY;
      mouseX = ev.clientX;
      mouseY = ev.clientY;
      hasMousePosition = true;

      if (
        cursorTarget &&
        dragCursorConfig &&
        dragCursorActive &&
        (ev.movementX !== 0 || ev.movementY !== 0)
      ) {
        cursorTarget.style.cursor = dragCursorConfig.dragging;
      }
    });

    update(() => {
      for (const k of axisKeys) {
        axes[k] = axisValue(k);
      }
      for (const k of buttonKeys) {
        const b = buttons[k];
        b.held = buttonHeld(k);
        b.pressed = buttonPressed(k);
        b.released = buttonReleased(k);
      }
      mouse.delta.x = mouseDeltaX;
      mouse.delta.y = mouseDeltaY;
      mouse.position = hasMousePosition ? { x: mouseX, y: mouseY } : null;

      Object.assign(previousKeyState, keyState);
      Object.assign(previousMouseState, mouseState);
      mouseDeltaX = 0;
      mouseDeltaY = 0;
    });

    return {
      ...inputContext,
      input: { axes, buttons, mouse } as InputShape<Options>,
    };
  };
}
