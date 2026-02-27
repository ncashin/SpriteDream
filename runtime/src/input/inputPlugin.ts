import type { GameContext, Plugin } from "../runtime/plugin";

export type InputContext = GameContext & {
  input: {
    keyboard: { isDown: (code: string) => boolean };
    mouse: {
      get x(): number;
      get y(): number;
      isDown: (button: number) => boolean;
    };
  };
};

export const inputPlugin = (): Plugin<InputContext> => (context) => {
  const { __gameRoot } = context;

  const keysDown = new Set<string>();
  let mouseX = 0;
  let mouseY = 0;
  const buttonsDown = new Set<number>();

  const updateMouse = (e: MouseEvent) => {
    const rect = __gameRoot.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    keysDown.add(e.code);
    if (e.target === __gameRoot) {
      e.preventDefault();
    }
  };

  const handleKeyUp = (e: KeyboardEvent) => {
    keysDown.delete(e.code);
  };

  const handleMouseMove = (e: MouseEvent) => updateMouse(e);
  const handleMouseDown = (e: MouseEvent) => {
    buttonsDown.add(e.button);
    updateMouse(e);
    __gameRoot.focus();
  };
  const handleMouseUp = (e: MouseEvent) => buttonsDown.delete(e.button);
  const handleMouseLeave = () => buttonsDown.clear();

  __gameRoot.tabIndex = 1;
  __gameRoot.addEventListener("keydown", handleKeyDown);
  __gameRoot.addEventListener("mousemove", handleMouseMove);
  __gameRoot.addEventListener("mousedown", handleMouseDown);
  __gameRoot.addEventListener("mouseup", handleMouseUp);
  __gameRoot.addEventListener("mouseleave", handleMouseLeave);
  window.addEventListener("keyup", handleKeyUp);
  __gameRoot.addEventListener("contextmenu", (e) => e.preventDefault());

  return {
    ...context,
    input: {
      keyboard: {
        isDown: (code: string) => keysDown.has(code),
      },
      mouse: {
        get x() {
          return mouseX;
        },
        get y() {
          return mouseY;
        },
        isDown: (button: number) => buttonsDown.has(button),
      },
    },
  };
};
