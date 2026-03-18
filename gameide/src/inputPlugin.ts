import { definePlugin } from "./plugin.js";
import { update } from "./gameloop.js";

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
  axes?: Record<string, { negative: string[]; positive: string[] }>;
  buttons?: Record<string, string[]>;
  target?: HTMLElement | Document;
  /**
   * Controls cursor appearance for click+drag interactions.
   * Only applies when the input target is an HTMLElement.
   */
  dragCursor?: {
    /** MouseEvent.button values to treat as "draggable" (defaults to [0]). */
    buttons?: number[];
    /** Cursor while the button is down but movement hasn't started yet. */
    down?: string;
    /** Cursor while moving with a draggable button held down. */
    dragging?: string;
    /**
     * Cursor to restore on mouse up. If omitted, restores the element's
     * previous inline `style.cursor`.
     */
    idle?: string;
  };
};

export type ExtractAxisKeys<C extends InputPluginOptions> = C extends {
  axes: infer A extends Record<string, unknown>;
}
  ? keyof A
  : keyof typeof DEFAULT_AXES;

export type ExtractButtonKeys<C extends InputPluginOptions> = C extends {
  buttons: infer B extends Record<string, unknown>;
}
  ? keyof B
  : keyof typeof DEFAULT_BUTTONS;

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

export type InputContext<
  AxisKey extends string = string,
  ButtonKey extends string = string,
> = {
  getAxis: (axisName: AxisKey) => number;
  getButton: (buttonName: ButtonKey) => boolean;
  getButtonDown: (buttonName: ButtonKey) => boolean;
  getButtonUp: (buttonName: ButtonKey) => boolean;
  getMouseDelta: () => { x: number; y: number };
  getMousePosition: () => { x: number; y: number } | null;
};

const inputPluginImpl = definePlugin(
  (options?: InputPluginOptions) =>
    (inputContext: InputPluginRequiredContext) => {
      const axes = { ...DEFAULT_AXES, ...options?.axes };
      const buttons = { ...DEFAULT_BUTTONS, ...options?.buttons };
      const target = options?.target ?? inputContext.rootElement ?? document;

      // TODO: This is an ugly way to ensure editor iframe receives keyboard input
      if (target instanceof HTMLElement) target.tabIndex = 0;

      const cursorTarget = target instanceof HTMLElement ? target : null;
      const dragCursorConfig = options?.dragCursor;
      const dragCursorButtons = dragCursorConfig?.buttons ?? [0];
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

      target.addEventListener("keydown", (e: Event) => {
        const ev = e as KeyboardEvent;
        console.log("[input] keydown", ev.code, ev.key);
        setKey(normalizeKey(ev.code), true);
        ev.preventDefault();
      });
      target.addEventListener("keyup", (e: Event) => {
        const ev = e as KeyboardEvent;
        console.log("[input] keyup", ev.code, ev.key);
        setKey(normalizeKey(ev.code), false);
        ev.preventDefault();
      });
      target.addEventListener("mousedown", (e: Event) => {
        const ev = e as MouseEvent;
        // TODO: This is an ugly way to ensure editor iframe receives keyboard input
        if (target instanceof HTMLElement) target.focus();
        console.log("[input] mousedown", ev.button, {
          x: ev.clientX,
          y: ev.clientY,
        });

        if (
          cursorTarget &&
          dragCursorConfig &&
          dragCursorButtons.includes(ev.button)
        ) {
          dragCursorActive = true;
          cursorTarget.style.cursor = dragCursorConfig.down ?? "grab";
        }

        mouseX = ev.clientX;
        mouseY = ev.clientY;
        hasMousePosition = true;
        setMouse(ev.button, true);
        ev.preventDefault();
      });
      target.addEventListener("mouseup", (e: Event) => {
        const ev = e as MouseEvent;
        console.log("[input] mouseup", ev.button, {
          x: ev.clientX,
          y: ev.clientY,
        });

        if (
          cursorTarget &&
          dragCursorConfig &&
          dragCursorButtons.includes(ev.button)
        ) {
          dragCursorActive = false;
          cursorTarget.style.cursor = dragCursorConfig.idle ?? originalInlineCursor;
        }

        mouseX = ev.clientX;
        mouseY = ev.clientY;
        hasMousePosition = true;
        setMouse(ev.button, false);
        ev.preventDefault();
      });
      target.addEventListener("mousemove", (e: Event) => {
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
          cursorTarget.style.cursor = dragCursorConfig.dragging ?? "grabbing";
        }
      });

      update(() => {
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

      function getMousePosition() {
        if (!hasMousePosition) return null;
        return { x: mouseX, y: mouseY };
      }

      const input = {
        getAxis,
        getButton,
        getButtonDown,
        getButtonUp,
        getMouseDelta,
        getMousePosition,
      };

      return { ...inputContext, input };
    },
);

export function inputPlugin<Options extends InputPluginOptions>(
  options?: Options,
): (input: InputPluginRequiredContext) => InputPluginRequiredContext & {
  input: InputContext<ExtractAxisKeys<Options>, ExtractButtonKeys<Options>>;
} {
  return inputPluginImpl(options) as (
    input: InputPluginRequiredContext,
  ) => InputPluginRequiredContext & {
    input: InputContext<ExtractAxisKeys<Options>, ExtractButtonKeys<Options>>;
  };
}
