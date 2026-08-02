import type { GameContext } from "../initialization";

type Buttons = Record<string, readonly string[]>;

type Axes = Record<
  string,
  {
    positiveKeys: readonly string[];
    negativeKeys: readonly string[];
  }
>;

type Controls<TButtons extends Buttons, TAxes extends Axes> = {
  buttons: TButtons;
  axes: TAxes;
};

type InputState<TButtons extends Buttons, TAxes extends Axes> = {
  button: {
    [K in keyof TButtons]: boolean;
  };
  axis: {
    [K in keyof TAxes]: number;
  };
};

const createKeys = <TObject extends Record<string, unknown>, TValue>(
  object: TObject,
  value: TValue,
): { [K in keyof TObject]: TValue } =>
  Object.fromEntries(Object.keys(object).map((key) => [key, value])) as {
    [K in keyof TObject]: TValue;
  };

export const inputPlugin =
  <TButtons extends Buttons, TAxes extends Axes>(controls: Controls<TButtons, TAxes>) =>
  (gameContext: GameContext) => {
    const { onUpdate } = gameContext;

    const keyState: Record<string, boolean> = {};

    const keyDownHandler = (event: KeyboardEvent) => {
      keyState[event.code] = true;
    };

    const keyUpHandler = (event: KeyboardEvent) => {
      keyState[event.code] = false;
    };

    document.addEventListener("keydown", keyDownHandler);
    document.addEventListener("keyup", keyUpHandler);

    const input: InputState<TButtons, TAxes> = {
      button: createKeys(controls.buttons, false),
      axis: createKeys(controls.axes, 0),
    };

    onUpdate(() => {
      for (const name in controls.buttons) {
        const keys = controls.buttons[name];

        input.button[name] = keys.some((key) => keyState[key]);
      }

      for (const name in controls.axes) {
        const axis = controls.axes[name];

        const positive = axis.positiveKeys.some((key) => keyState[key]);
        const negative = axis.negativeKeys.some((key) => keyState[key]);

        input.axis[name] = Number(positive) - Number(negative);
      }
    });

    return {
      ...gameContext,
      input,
    };
  };
