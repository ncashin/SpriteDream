import type { Application, Container } from "pixi.js";
import { onEditorUpdate, onModeChange } from "gameide";

export type ViewportState = {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  scale: number;
};

type ViewportListener = (viewport: Readonly<ViewportState>) => void;

function clientToScreen(rootElement: HTMLElement, clientX: number, clientY: number) {
  const r = rootElement.getBoundingClientRect();
  return { screenX: clientX - r.left, screenY: clientY - r.top };
}

function viewportCenterForAnchorAtScreen(
  width: number,
  height: number,
  anchorWorld: { x: number; y: number },
  screenX: number,
  screenY: number,
  scale: number,
): { centerX: number; centerY: number } {
  return {
    centerX: anchorWorld.x - (screenX - width / 2) / scale,
    centerY: anchorWorld.y - (height / 2 - screenY) / scale,
  };
}

export function createViewport(
  width: number,
  height: number,
  options: {
    centerX?: number;
    centerY?: number;
    scale?: number;
    rootElement?: HTMLElement;
  } = {},
): {
  get state(): Readonly<ViewportState>;
  setCenter(centerX: number, centerY: number): void;
  setScale(scale: number): void;
  setScreenSize(width: number, height: number): void;
  onChange(callback: ViewportListener): () => void;
  screenToWorld(clientX: number, clientY: number): { x: number; y: number };
  worldToScreen(worldX: number, worldY: number): { screenX: number; screenY: number };
} {
  const state: ViewportState = {
    centerX: options.centerX ?? 0,
    centerY: options.centerY ?? 0,
    width: Math.max(0, width),
    height: Math.max(0, height),
    scale: options.scale ?? 1,
  };

  const rootElement = options.rootElement;
  const listeners = new Set<ViewportListener>();

  const emitChange = () => {
    for (const listener of listeners) listener({ ...state });
  };

  return {
    get state() {
      return { ...state };
    },
    setCenter(centerX: number, centerY: number) {
      if (state.centerX === centerX && state.centerY === centerY) return;
      state.centerX = centerX;
      state.centerY = centerY;
      emitChange();
    },
    setScale(nextScale: number) {
      const resolvedScale =
        Number.isFinite(nextScale) && nextScale > 0 ? nextScale : state.scale;
      if (state.scale === resolvedScale) return;
      state.scale = resolvedScale;
      emitChange();
    },
    setScreenSize(nextWidth: number, nextHeight: number) {
      const width = Math.max(0, nextWidth);
      const height = Math.max(0, nextHeight);
      if (state.width === width && state.height === height) return;
      state.width = width;
      state.height = height;
      emitChange();
    },
    onChange(callback) {
      callback({ ...state });
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
      };
    },
    screenToWorld(clientX: number, clientY: number): { x: number; y: number } {
      if (!rootElement) {
        throw new Error(
          "GameIDE: viewport.screenToWorld requires rootElement when creating the viewport.",
        );
      }
      const { screenX, screenY } = clientToScreen(rootElement, clientX, clientY);
      const {
        width: viewportWidth,
        height: viewportHeight,
        centerX,
        centerY,
        scale,
      } = state;
      const worldOriginScreenX = viewportWidth / 2 - centerX * scale;
      const worldOriginScreenY = viewportHeight / 2 + centerY * scale;
      return {
        x: (screenX - worldOriginScreenX) / scale,
        y: (worldOriginScreenY - screenY) / scale,
      };
    },
    worldToScreen(worldX: number, worldY: number): { screenX: number; screenY: number } {
      const { width, height, centerX, centerY, scale } = state;
      return {
        screenX: width / 2 + (worldX - centerX) * scale,
        screenY: height / 2 - (worldY - centerY) * scale,
      };
    },
  };
}

export function applyViewportToWorldContainer(
  world: Container,
  viewport: Readonly<ViewportState>,
): void {
  const { width, height, centerX, centerY, scale } = viewport;
  world.scale.set(scale, -scale);
  world.position.set(width / 2 - centerX * scale, height / 2 + centerY * scale);
}

export type ViewportController = ReturnType<typeof createViewport>;

export type PixiViewportInput = {
  buttons: {
    Click: { held: boolean; pressed: boolean; released: boolean };
  };
  mouse: {
    position: { x: number; y: number } | null;
    wheel: { x: number; y: number };
  };
};

export type PixiViewportOptions = {
  world: Container;
  app: Application;
  rootElement: HTMLElement;
  input: PixiViewportInput;
  onEditorClickWorld?: (worldPoint: { x: number; y: number }) => void;
  shouldSuppressEditorViewport?: () => boolean;
};

export function pixiViewport(options: PixiViewportOptions): {
  viewport: ViewportController;
  syncViewportScreenSize: () => void;
  unsubscribe: () => void;
} {
  const {
    world,
    app,
    rootElement,
    input,
    onEditorClickWorld,
    shouldSuppressEditorViewport,
  } = options;

  let disposed = false;

  const viewport = createViewport(app.screen.width, app.screen.height, {
    rootElement,
  });

  const unsubscribeViewport = viewport.onChange((next) => {
    if (disposed) return;
    applyViewportToWorldContainer(world, next);
  });

  const syncViewportScreenSize = (): void => {
    const { width, height } = rootElement.getBoundingClientRect();
    if (width > 0 && height > 0) {
      app.resize();
      viewport.setScreenSize(app.screen.width, app.screen.height);
    }
  };

  const resizeObserver = new ResizeObserver(() => {
    syncViewportScreenSize();
  });
  resizeObserver.observe(rootElement);

  const editorViewportGesture = createEditorViewportGestureState();

  const resetViewportForModeChange = (): void => {
    viewport.setCenter(0, 0);
    viewport.setScale(1);
    editorViewportGesture.panning = false;
    editorViewportGesture.anchorWorld = null;
    editorViewportGesture.pressClient = null;
  };

  const releaseModeViewportReset = onModeChange(resetViewportForModeChange);

  const releaseEditorViewport = onEditorUpdate(() => {
    if (disposed) return;

    if (shouldSuppressEditorViewport?.()) {
      editorViewportGesture.panning = false;
      editorViewportGesture.anchorWorld = null;
      editorViewportGesture.pressClient = null;
      return;
    }

    const { shouldPickAtClick } = editorViewportEditorFrame(editorViewportGesture, {
      rootElement,
      viewport,
      panButton: input.buttons.Click,
      clientPosition: input.mouse.position,
      wheel: input.mouse.wheel,
    });

    if (
      shouldPickAtClick &&
      onEditorClickWorld &&
      input.mouse.position
    ) {
      onEditorClickWorld(
        viewport.screenToWorld(input.mouse.position.x, input.mouse.position.y),
      );
    }
  });

  return {
    viewport,
    syncViewportScreenSize,
    unsubscribe: () => {
      disposed = true;
      releaseModeViewportReset();
      releaseEditorViewport();
      resizeObserver.disconnect();
      unsubscribeViewport();
    },
  };
}

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
  panButton: { held: boolean; pressed: boolean; released: boolean };
  clientPosition: { x: number; y: number } | null;
  wheel: { x: number; y: number };
  minScale?: number;
  maxScale?: number;
  zoomSensitivity?: number;
  panSlopPx?: number;
};

export type EditorViewportFrameResult = {
  shouldPickAtClick: boolean;
};

function zoomViewportAtClient(
  viewport: ViewportController,
  rootElement: HTMLElement,
  clientX: number,
  clientY: number,
  zoomFactor: number,
  minScale: number,
  maxScale: number,
): void {
  const anchorWorld = viewport.screenToWorld(clientX, clientY);
  const { screenX, screenY } = clientToScreen(rootElement, clientX, clientY);
  const { width, height, scale: currentScale } = viewport.state;
  const nextScale = Math.min(maxScale, Math.max(minScale, currentScale * zoomFactor));
  if (nextScale === currentScale) return;
  const { centerX, centerY } = viewportCenterForAnchorAtScreen(
    width,
    height,
    anchorWorld,
    screenX,
    screenY,
    nextScale,
  );
  viewport.setScale(nextScale);
  viewport.setCenter(centerX, centerY);
}

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
  const panSlopPixelsSquared = panSlopPx * panSlopPx;

  let shouldPickAtClick = false;

  if (wheel.y !== 0 && clientPosition) {
    const zoomFactor = Math.exp(-wheel.y * zoomSensitivity);
    zoomViewportAtClient(
      viewport,
      rootElement,
      clientPosition.x,
      clientPosition.y,
      zoomFactor,
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
    const deltaClientX = clientPosition.x - gesture.pressClient.x;
    const deltaClientY = clientPosition.y - gesture.pressClient.y;
    if (
      !gesture.panning &&
      deltaClientX * deltaClientX + deltaClientY * deltaClientY >= panSlopPixelsSquared
    ) {
      gesture.panning = true;
    }
    if (gesture.panning && gesture.anchorWorld) {
      const { screenX, screenY } = clientToScreen(
        rootElement,
        clientPosition.x,
        clientPosition.y,
      );
      const { width, height, scale } = viewport.state;
      const { centerX, centerY } = viewportCenterForAnchorAtScreen(
        width,
        height,
        gesture.anchorWorld,
        screenX,
        screenY,
        scale,
      );
      viewport.setCenter(centerX, centerY);
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
