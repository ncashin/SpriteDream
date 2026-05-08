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

export type ViewportController = ReturnType<typeof createViewport>;

/** Mutable state for editor pan (click–drag) vs click-to-select. */
export type EditorViewportGestureState = {
  panning: boolean;
  anchorWorld: { x: number; y: number } | null;
  pressClient: { x: number; y: number } | null;
};

export function createEditorViewportGestureState(): EditorViewportGestureState {
  return { panning: false, anchorWorld: null, pressClient: null };
}

export type EditorViewportFrameOptions = {
  rootElement: HTMLElement;
  viewport: ViewportController;
  /** Primary button: drag pans after slop; release without pan may be a click. */
  panButton: { held: boolean; pressed: boolean; released: boolean };
  clientPosition: { x: number; y: number } | null;
  wheel: { x: number; y: number };
  minScale?: number;
  maxScale?: number;
  /** Zoom factor uses `exp(-wheel.y * zoomSensitivity)`. */
  zoomSensitivity?: number;
  /** Movement past this distance (pixels) turns the gesture into a pan. @default 5 */
  panSlopPx?: number;
};

export type EditorViewportFrameResult = {
  /** True on the frame the pan button is released and the gesture was a click (no pan). */
  shouldPickAtClick: boolean;
};

function zoomViewportAtClient(
  viewport: ViewportController,
  rootElement: HTMLElement,
  clientX: number,
  clientY: number,
  factor: number,
  minScale: number,
  maxScale: number,
): void {
  const W = viewport.screenToWorld(clientX, clientY);
  const rect = rootElement.getBoundingClientRect();
  const sx = clientX - rect.left;
  const sy = clientY - rect.top;
  const { width: vw, height: vh, scale: s } = viewport.state;
  const nextScale = Math.min(maxScale, Math.max(minScale, s * factor));
  if (nextScale === s) return;
  const newCx = W.x - (sx - vw / 2) / nextScale;
  const newCy = W.y - (vh / 2 - sy) / nextScale;
  viewport.setScale(nextScale);
  viewport.setCenter(newCx, newCy);
}

/**
 * Editor-only viewport: wheel zoom (toward cursor) and click-drag pan using {@link inputPlugin} mouse state.
 * Invoke from the `editorUpdate` callback each frame.
 */
export function editorViewportEditorFrame(
  gesture: EditorViewportGestureState,
  options: EditorViewportFrameOptions,
): EditorViewportFrameResult {
  const {
    viewport,
    rootElement,
    panButton,
    clientPosition,
    wheel,
  } = options;
  const minScale = options.minScale ?? 0.05;
  const maxScale = options.maxScale ?? 64;
  const zoomSensitivity = options.zoomSensitivity ?? 0.002;
  const panSlopPx = options.panSlopPx ?? 5;
  const slop2 = panSlopPx * panSlopPx;

  let shouldPickAtClick = false;

  if (wheel.y !== 0 && clientPosition) {
    const factor = Math.exp(-wheel.y * zoomSensitivity);
    zoomViewportAtClient(
      viewport,
      rootElement,
      clientPosition.x,
      clientPosition.y,
      factor,
      minScale,
      maxScale,
    );
  }

  if (panButton.pressed && clientPosition) {
    gesture.panning = false;
    gesture.pressClient = { x: clientPosition.x, y: clientPosition.y };
    gesture.anchorWorld = viewport.screenToWorld(clientPosition.x, clientPosition.y);
  }

  if (panButton.held && clientPosition && gesture.pressClient) {
    const dx = clientPosition.x - gesture.pressClient.x;
    const dy = clientPosition.y - gesture.pressClient.y;
    if (!gesture.panning && dx * dx + dy * dy >= slop2) {
      gesture.panning = true;
    }
    if (gesture.panning && gesture.anchorWorld) {
      const rect = rootElement.getBoundingClientRect();
      const sx = clientPosition.x - rect.left;
      const sy = clientPosition.y - rect.top;
      const { width: vw, height: vh, scale: s } = viewport.state;
      const cx = gesture.anchorWorld.x - (sx - vw / 2) / s;
      const cy = gesture.anchorWorld.y - (vh / 2 - sy) / s;
      viewport.setCenter(cx, cy);
    }
  }

  if (panButton.released) {
    if (!gesture.panning && gesture.pressClient !== null) {
      shouldPickAtClick = true;
    }
    gesture.panning = false;
    gesture.anchorWorld = null;
    gesture.pressClient = null;
  }

  return { shouldPickAtClick };
}
