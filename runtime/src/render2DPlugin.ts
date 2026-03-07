import { definePlugin } from "./plugin";
import invariant from "tiny-invariant";

export type Render2DPluginRequiredContext = { rootElement: HTMLElement };
export type Render2DPluginOptions = {};

export type Render2DContext = {
  canvasElement: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
};

export const render2DPlugin = definePlugin<
  Render2DPluginOptions,
  Render2DPluginRequiredContext,
  { render2D: Render2DContext }
>(
  (_options?: Render2DPluginOptions) => (inputContext: Render2DPluginRequiredContext): Render2DPluginRequiredContext & { render2D: Render2DContext } => {
    const rootElement = inputContext.rootElement;
    const canvasElement = document.createElement("canvas");
    rootElement.appendChild(canvasElement);

    const context = canvasElement.getContext("2d");
    invariant(context);

    return { ...inputContext, render2D: { canvasElement, context } };
  },
);
