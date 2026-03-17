import { definePlugin } from "./plugin.js";
import invariant from "tiny-invariant";

export type Render2DPluginRequiredContext = { rootElement: HTMLElement };
export type Render2DPluginOptions = {};

export const renderPlugin2D = definePlugin(
  (_options?: Render2DPluginOptions) =>
    (inputContext: Render2DPluginRequiredContext) => {
      const rootElement = inputContext.rootElement;
      const canvasElement = document.createElement("canvas");
      rootElement.appendChild(canvasElement);

      const context = canvasElement.getContext("2d");
      invariant(context);

      const resize = () => {
        const devicePixelRatio = window.devicePixelRatio ?? 1;
        const rootWidth = rootElement.clientWidth;
        const rootHeight = rootElement.clientHeight;
        canvasElement.width = Math.floor(rootWidth * devicePixelRatio);
        canvasElement.height = Math.floor(rootHeight * devicePixelRatio);
        canvasElement.style.width = `${rootWidth}px`;
        canvasElement.style.height = `${rootHeight}px`;
        context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      };

      resize();
      window.addEventListener("resize", resize);

      const resizeObserver = new ResizeObserver(() => resize());
      resizeObserver.observe(rootElement);
      requestAnimationFrame(() => resize());

      return { ...inputContext, render2D: { canvasElement, context } };
    },
);

