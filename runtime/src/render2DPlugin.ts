export type Render2DContext = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
};

export type Render2DPluginRequiredContext = { rootElement: HTMLElement };

export const render2DPlugin = <T extends Render2DPluginRequiredContext>(
  inputContext: T,
) => {
  const rootElement = inputContext.rootElement;
  const canvasElement = document.createElement("canvas");
  rootElement.appendChild(canvasElement);

  const context = canvasElement.getContext("2d");
  if (!context) {
    throw new Error("Could not get 2D rendering context");
  }

  return { ...inputContext, render2D: { canvasElement, context } };
};
