const MOUSE_BUTTONS = ["mouseleft", "mousemiddle", "mouseright", "mouseback", "mouseforward"];

export type ButtonState = {
  readonly down: boolean;
  readonly pressed: boolean;
  readonly released: boolean;
};

export type AxisBinding = {
  positive: readonly string[];
  negative: readonly string[];
};

export type InputMap<
  Buttons extends Record<string, readonly string[]>,
  Axes extends Record<string, AxisBinding>,
> = {
  readonly buttons: { readonly [Name in keyof Buttons]: ButtonState };
  readonly axes: { readonly [Name in keyof Axes]: number };
  update(): void;
};

const normalize = (input: string) => input.toLowerCase();

const anyHeld = (held: Record<string, boolean>, inputs: readonly string[]) =>
  inputs.some((input) => held[input]);

const axisValue = (
  held: Record<string, boolean>,
  positive: readonly string[],
  negative: readonly string[],
) => (anyHeld(held, positive) ? 1 : 0) - (anyHeld(held, negative) ? 1 : 0);

const keyIds = (event: KeyboardEvent) => [normalize(event.key), normalize(event.code)];

const mouseIds = (button: number) => {
  const name = MOUSE_BUTTONS[button];
  return name === undefined ? [`mouse${button}`] : [`mouse${button}`, name];
};

const isTyping = (target: EventTarget | null) => {
  if (target instanceof HTMLInputElement) return true;
  if (target instanceof HTMLTextAreaElement) return true;
  if (target instanceof HTMLSelectElement) return true;
  return target instanceof HTMLElement && target.isContentEditable;
};

export const inputMap = <
  const Buttons extends Record<string, readonly string[]>,
  const Axes extends Record<string, AxisBinding>,
>(
  map: { buttons: Buttons; axes: Axes },
  options?: { signal?: AbortSignal },
): InputMap<Buttons, Axes> => {
  const buttonNames = Object.keys(map.buttons) as (keyof Buttons & string)[];
  const axisNames = Object.keys(map.axes) as (keyof Axes & string)[];

  const bindings: {
    buttons: Record<string, readonly string[]>;
    axes: Record<string, { positive: readonly string[]; negative: readonly string[] }>;
    bound: Record<string, true>;
  } = {
    buttons: Object.fromEntries(buttonNames.map((name) => [name, map.buttons[name].map(normalize)])),
    axes: Object.fromEntries(
      axisNames.map((name) => [
        name,
        {
          positive: map.axes[name].positive.map(normalize),
          negative: map.axes[name].negative.map(normalize),
        },
      ]),
    ),
    bound: Object.fromEntries(
      [
        ...buttonNames.flatMap((name) => map.buttons[name]),
        ...axisNames.flatMap((name) => [...map.axes[name].positive, ...map.axes[name].negative]),
      ]
        .map((input) => [normalize(input), true]),
    ) as Record<string, true>,
  };

  const state = {
    held: {} as Record<string, boolean>,
    wasDown: {} as Record<string, boolean>,
    pressed: {} as Record<string, boolean>,
    released: {} as Record<string, boolean>,
  };

  const hold = (ids: readonly string[]) => {
    state.held = { ...state.held, ...Object.fromEntries(ids.map((id) => [id, true])) };
  };

  const release = (ids: readonly string[]) => {
    state.held = Object.fromEntries(Object.entries(state.held).filter(([id]) => !ids.includes(id)));
  };

  const isBound = (ids: readonly string[]) => ids.some((id) => bindings.bound[id]);

  const buttons = Object.fromEntries(
    buttonNames.map((name) => [
      name,
      {
        get down() {
          return anyHeld(state.held, bindings.buttons[name]);
        },
        get pressed() {
          return Boolean(state.pressed[name]);
        },
        get released() {
          return Boolean(state.released[name]);
        },
      },
    ]),
  ) as { [Name in keyof Buttons]: ButtonState };

  const axes = axisNames.reduce(
    (axes, name) => {
      const axis = bindings.axes[name];
      return Object.defineProperty(axes, name, {
        enumerable: true,
        get() {
          return axisValue(state.held, axis.positive, axis.negative);
        },
      });
    },
    {} as { [Name in keyof Axes]: number },
  );

  const update = () => {
    const down = Object.fromEntries(
      buttonNames.map((name) => [name, anyHeld(state.held, bindings.buttons[name])]),
    );
    state.pressed = Object.fromEntries(
      buttonNames.filter((name) => down[name] && !state.wasDown[name]).map((name) => [name, true]),
    );
    state.released = Object.fromEntries(
      buttonNames.filter((name) => !down[name] && state.wasDown[name]).map((name) => [name, true]),
    );
    state.wasDown = down;
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (isTyping(event.target)) return;
    const ids = keyIds(event);
    if (!isBound(ids)) return;
    event.preventDefault();
    if (event.repeat) return;
    hold(ids);
  };

  const onKeyUp = (event: KeyboardEvent) => {
    release(keyIds(event));
  };

  const onMouseDown = (event: MouseEvent) => {
    if (isTyping(event.target)) return;
    const ids = mouseIds(event.button);
    if (!isBound(ids)) return;
    hold(ids);
  };

  const onMouseUp = (event: MouseEvent) => {
    release(mouseIds(event.button));
  };

  const onBlur = () => {
    state.held = {};
  };

  if (typeof window !== "undefined") {
    const signal = options?.signal;
    window.addEventListener("keydown", onKeyDown, { signal });
    window.addEventListener("keyup", onKeyUp, { signal });
    window.addEventListener("mousedown", onMouseDown, { signal });
    window.addEventListener("mouseup", onMouseUp, { signal });
    window.addEventListener("blur", onBlur, { signal });
  }

  return { buttons, axes, update };
};
