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
  drag: {
    isDragging: boolean;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    offsetX: number;
    offsetY: number;
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
    getDragState: () => InputState["drag"];
    startDrag: (x: number, y: number) => void;
    updateDrag: (x: number, y: number) => void;
    endDrag: () => void;
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
  const drag = {
    isDragging: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    offsetX: 0,
    offsetY: 0,
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

  window.addEventListener("contextmenu", (e) => {
    e.preventDefault();
  });

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
        drag: { ...drag },
      }),
      getDragState: () => ({ ...drag }),
      startDrag: (x: number, y: number) => {
        drag.isDragging = true;
        drag.startX = x;
        drag.startY = y;
        drag.currentX = x;
        drag.currentY = y;
        drag.offsetX = 0;
        drag.offsetY = 0;
      },
      updateDrag: (x: number, y: number) => {
        if (drag.isDragging) {
          drag.currentX = x;
          drag.currentY = y;
          drag.offsetX = x - drag.startX;
          drag.offsetY = y - drag.startY;
        }
      },
      endDrag: () => {
        drag.isDragging = false;
      },
    },
  };

  return {
    ...context,
    ...inputAPI,
  };
}

