import type { ContextExtension, InitialGameContext } from "./gameContext";
import { addDrawCallback } from "./gameloop";

export type InputState = {
  keys: Record<string, boolean>;
  mouse: {
    x: number;
    y: number;
    buttons: {
      left: boolean;
      middle: boolean;
      right: boolean;
    };
  };
};

export type InputAPI = {
  input: {
    isKeyPressed: (key: string) => boolean;
    isKeyDown: (key: string) => boolean;
    isKeyUp: (key: string) => boolean;
    getMousePosition: () => { x: number; y: number };
    isMouseButtonPressed: (button: "left" | "middle" | "right") => boolean;
    getState: () => InputState;
  };
};

export function inputPlugin<T extends InitialGameContext>(
  context: T
): ContextExtension<T, InputAPI> {
  const keys: Record<string, boolean> = {};
  // Track previous frame's key state for keyDown/keyUp detection
  const previousKeys: Record<string, boolean> = {};
  const mouse = {
    x: 0,
    y: 0,
    buttons: {
      left: false,
      middle: false,
      right: false,
    },
  };

  // Set up keyboard event listeners
  window.addEventListener("keydown", (e) => {
    keys[e.key.toLowerCase()] = true;
  });

  window.addEventListener("keyup", (e) => {
    keys[e.key.toLowerCase()] = false;
  });

  // Set up mouse event listeners
  window.addEventListener("mousemove", (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });

  window.addEventListener("mousedown", (e) => {
    if (e.button === 0) mouse.buttons.left = true;
    if (e.button === 1) mouse.buttons.middle = true;
    if (e.button === 2) mouse.buttons.right = true;
  });

  window.addEventListener("mouseup", (e) => {
    if (e.button === 0) mouse.buttons.left = false;
    if (e.button === 1) mouse.buttons.middle = false;
    if (e.button === 2) mouse.buttons.right = false;
  });

  // Prevent context menu on right click
  window.addEventListener("contextmenu", (e) => {
    e.preventDefault();
  });

  // Update previous keys at the end of each frame (after all update callbacks)
  // This ensures isKeyDown/isKeyUp work correctly by comparing to the previous frame
  addDrawCallback(() => {
    Object.assign(previousKeys, keys);
  });

  const inputAPI: InputAPI = {
    input: {
      isKeyPressed: (key: string) => {
        return keys[key.toLowerCase()] === true;
      },
      isKeyDown: (key: string) => {
        const lowerKey = key.toLowerCase();
        return keys[lowerKey] === true && previousKeys[lowerKey] !== true;
      },
      isKeyUp: (key: string) => {
        const lowerKey = key.toLowerCase();
        return keys[lowerKey] === false && previousKeys[lowerKey] === true;
      },
      getMousePosition: () => ({
        x: mouse.x,
        y: mouse.y,
      }),
      isMouseButtonPressed: (button: "left" | "middle" | "right") => {
        return mouse.buttons[button];
      },
      getState: () => ({
        keys: { ...keys },
        mouse: {
          x: mouse.x,
          y: mouse.y,
          buttons: { ...mouse.buttons },
        },
      }),
    },
  };

  return {
    ...context,
    ...inputAPI,
  };
}

