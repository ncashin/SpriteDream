import { update } from "../../lifecycle/gameloop.js";
import { GameIDEMode, getMode } from "../../lifecycle/mode.js";
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

export type InputMouseHandling = "default" | "editor";

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
  mouseHandling?: InputMouseHandling;
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
    wheel: { x: number; y: number };
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
      axisKeys.map((axisKey) => [axisKey, 0]),
    ) as InputShape<Options>["axes"];

    const buttons = Object.fromEntries(
      buttonKeys.map((buttonKey) => [
        buttonKey,
        { held: false, pressed: false, released: false },
      ]),
    ) as InputShape<Options>["buttons"];

    const mouse = {
      delta: { x: 0, y: 0 },
      position: null as { x: number; y: number } | null,
      wheel: { x: 0, y: 0 },
    };

    let wheelAccumulatorX = 0;
    let wheelAccumulatorY = 0;
    const mouseHandling = options.mouseHandling ?? "default";
    const rootElement = inputContext.rootElement;

    if (mouseHandling === "editor") {
      target.addEventListener(
        "wheel",
        (event) => {
          if (getMode() !== GameIDEMode.Editor) return;
          if (
            !(event.target instanceof Node) ||
            !rootElement.contains(event.target)
          )
            return;
          const wheelEvent = event as WheelEvent;
          wheelEvent.preventDefault();
          wheelAccumulatorX += wheelEvent.deltaX;
          wheelAccumulatorY += wheelEvent.deltaY;
        },
        { passive: false },
      );
    }

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
        const mouseButton = binding.slice(5);
        return mouseState[mouseButton] ?? false;
      }
      return false;
    }

    function wasBindingDown(binding: string): boolean {
      if (binding.startsWith("Key"))
        return previousKeyState[binding] ?? false;
      if (binding.startsWith("Mouse")) {
        const mouseButton = binding.slice(5);
        return previousMouseState[mouseButton] ?? false;
      }
      return false;
    }

    function axisValue(axisName: AxisKeys<Options>): number {
      const config = axesConfig[axisName];
      if (!config) return 0;
      let value = 0;
      for (const binding of config.negative)
        if (isBindingDown(binding)) value -= 1;
      for (const binding of config.positive)
        if (isBindingDown(binding)) value += 1;
      return Math.max(-1, Math.min(1, value));
    }

    function buttonHeld(buttonName: ButtonKeys<Options>): boolean {
      const bindings = buttonsConfig[buttonName];
      if (!bindings) return false;
      return bindings.some((binding) => isBindingDown(binding));
    }

    function buttonPressed(buttonName: ButtonKeys<Options>): boolean {
      const bindings = buttonsConfig[buttonName];
      if (!bindings) return false;
      return bindings.some(
        (binding) => isBindingDown(binding) && !wasBindingDown(binding),
      );
    }

    function buttonReleased(buttonName: ButtonKeys<Options>): boolean {
      const bindings = buttonsConfig[buttonName];
      if (!bindings) return false;
      return bindings.some(
        (binding) => !isBindingDown(binding) && wasBindingDown(binding),
      );
    }

    target.addEventListener("keydown", (event) => {
      const keyboardEvent = event as KeyboardEvent;
      setKey(normalizeKey(keyboardEvent.code), true);
      keyboardEvent.preventDefault();
    });
    target.addEventListener("keyup", (event) => {
      const keyboardEvent = event as KeyboardEvent;
      setKey(normalizeKey(keyboardEvent.code), false);
      keyboardEvent.preventDefault();
    });
    target.addEventListener("mousedown", (event) => {
      const mouseEvent = event as MouseEvent;
      if (target instanceof HTMLElement) target.focus();

      if (
        cursorTarget &&
        dragCursorConfig &&
        dragCursorConfig.buttons.includes(mouseEvent.button)
      ) {
        dragCursorActive = true;
        cursorTarget.style.cursor = dragCursorConfig.down;
      }

      mouseX = mouseEvent.clientX;
      mouseY = mouseEvent.clientY;
      hasMousePosition = true;
      setMouse(mouseEvent.button, true);
      mouseEvent.preventDefault();
    });
    target.addEventListener("mouseup", (event) => {
      const mouseEvent = event as MouseEvent;

      if (
        cursorTarget &&
        dragCursorConfig &&
        dragCursorConfig.buttons.includes(mouseEvent.button)
      ) {
        dragCursorActive = false;
        cursorTarget.style.cursor =
          dragCursorConfig.idle ?? originalInlineCursor;
      }

      mouseX = mouseEvent.clientX;
      mouseY = mouseEvent.clientY;
      hasMousePosition = true;
      setMouse(mouseEvent.button, false);
      mouseEvent.preventDefault();
    });
    target.addEventListener("mousemove", (event) => {
      const mouseEvent = event as MouseEvent;
      mouseDeltaX += mouseEvent.movementX;
      mouseDeltaY += mouseEvent.movementY;
      mouseX = mouseEvent.clientX;
      mouseY = mouseEvent.clientY;
      hasMousePosition = true;

      if (
        cursorTarget &&
        dragCursorConfig &&
        dragCursorActive &&
        (mouseEvent.movementX !== 0 || mouseEvent.movementY !== 0)
      ) {
        cursorTarget.style.cursor = dragCursorConfig.dragging;
      }
    });

    update(() => {
      for (const axisKey of axisKeys) {
        axes[axisKey] = axisValue(axisKey);
      }
      for (const buttonKey of buttonKeys) {
        const button = buttons[buttonKey];
        button.held = buttonHeld(buttonKey);
        button.pressed = buttonPressed(buttonKey);
        button.released = buttonReleased(buttonKey);
      }
      mouse.delta.x = mouseDeltaX;
      mouse.delta.y = mouseDeltaY;
      mouse.position = hasMousePosition ? { x: mouseX, y: mouseY } : null;
      mouse.wheel.x = wheelAccumulatorX;
      mouse.wheel.y = wheelAccumulatorY;

      Object.assign(previousKeyState, keyState);
      Object.assign(previousMouseState, mouseState);
      mouseDeltaX = 0;
      mouseDeltaY = 0;
      wheelAccumulatorX = 0;
      wheelAccumulatorY = 0;
    });

    return {
      ...inputContext,
      input: { axes, buttons, mouse } as InputShape<Options>,
    };
  };
}
