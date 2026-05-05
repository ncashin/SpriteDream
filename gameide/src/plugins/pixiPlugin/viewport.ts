import type { Container } from "pixi.js";
import { createCallbackRegistry } from "../../lifecycle/callbackRegistry.js";

export type ViewportState = {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  scale: number;
};

type ViewportListener = (viewport: Readonly<ViewportState>) => void;

function shallowChanged(
  a: ViewportState,
  b: Pick<ViewportState, "centerX" | "centerY" | "width" | "height" | "scale">,
): boolean {
  return (
    a.centerX !== b.centerX ||
    a.centerY !== b.centerY ||
    a.width !== b.width ||
    a.height !== b.height ||
    a.scale !== b.scale
  );
}

export function createViewport(
  width: number,
  height: number,
  options: {
    centerX?: number;
    centerY?: number;
    scale?: number;
    /** Required for {@link Viewport#screenToWorld}. */
    rootElement?: HTMLElement;
  } = {},
): {
  get state(): Readonly<ViewportState>;
  setCenter(centerX: number, centerY: number): void;
  setScale(scale: number): void;
  setScreenSize(width: number, height: number): void;
  onChange(callback: ViewportListener): () => void;
  screenToWorld(clientX: number, clientY: number): { x: number; y: number };
} {
  const internal: ViewportState = {
    centerX: options.centerX ?? 0,
    centerY: options.centerY ?? 0,
    width: Math.max(0, width),
    height: Math.max(0, height),
    scale: options.scale ?? 1,
  };

  const rootElement = options.rootElement;

  const registry = createCallbackRegistry<ViewportListener>();

  const notify = () => {
    registry.run({ ...internal });
  };

  return {
    get state() {
      return { ...internal };
    },
    setCenter(centerX: number, centerY: number) {
      if (internal.centerX === centerX && internal.centerY === centerY) return;
      internal.centerX = centerX;
      internal.centerY = centerY;
      notify();
    },
    setScale(scale: number) {
      const next = Number.isFinite(scale) && scale > 0 ? scale : internal.scale;
      if (internal.scale === next) return;
      internal.scale = next;
      notify();
    },
    setScreenSize(w: number, h: number) {
      const width = Math.max(0, w);
      const height = Math.max(0, h);
      if (!shallowChanged(internal, { ...internal, width, height })) return;
      internal.width = width;
      internal.height = height;
      notify();
    },
    onChange(callback) {
      callback({ ...internal });
      return registry.register(callback);
    },
    screenToWorld(clientX: number, clientY: number): { x: number; y: number } {
      if (!rootElement) {
        throw new Error(
          "GameIDE: viewport.screenToWorld requires rootElement when creating the viewport.",
        );
      }
      const rootRect = rootElement.getBoundingClientRect();
      const sx = clientX - rootRect.left;
      const sy = clientY - rootRect.top;
      const { width: vw, height: vh, centerX, centerY, scale } = internal;
      const px = vw / 2 - centerX * scale;
      const py = vh / 2 + centerY * scale;
      return {
        x: (sx - px) / scale,
        y: (py - sy) / scale,
      };
    },
  };
}

export function applyViewportToWorldContainer(
  world: Container,
  viewport: Readonly<ViewportState>,
): void {
  const { width, height, centerX, centerY, scale } = viewport;
  // Negative scale.y: scene +Y is up (Pixi stage is +Y down).
  world.scale.set(scale, -scale);
  world.position.set(width / 2 - centerX * scale, height / 2 + centerY * scale);
}
