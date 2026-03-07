import { definePlugin } from "./plugin";
import invariant from "tiny-invariant";

export type Render2DPluginRequiredContext = { rootElement: HTMLElement };
export type Render2DPluginOptions = {};

export const render2DPlugin = definePlugin(
  (_options?: Render2DPluginOptions) =>
    (inputContext: Render2DPluginRequiredContext) => {
      const rootElement = inputContext.rootElement;
      const canvasElement = document.createElement("canvas");
      rootElement.appendChild(canvasElement);

      const context = canvasElement.getContext("2d");
      invariant(context);

      return { ...inputContext, render2D: { canvasElement, context } };
    },
);
