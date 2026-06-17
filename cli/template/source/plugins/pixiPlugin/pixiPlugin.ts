import {
  Application,
  Container,
  type ApplicationOptions,
} from "pixi.js";
import type { PlanckPluginAPI } from "../planckPlugin/planckPlugin.js";
import {
  deselectObject,
  getEditorDebugUIEnabled,
  onEditorDebugUIChange,
  selectObject,
  type Plugin,
} from "gameide";
import { pickSceneObjectAtWorldPoint } from "./editorPick.js";
import { pixiSprites } from "./sprite.js";
import {
  type ViewportController,
  pixiViewport,
} from "./viewport.js";
import { colliderDebug } from "./colliderDebug.js";
import { selectionOverlay } from "./selectionOverlay.js";
import { transformGizmoOverlay } from "./transformGizmoOverlay.js";
import {
  getDevicePixelRatio,
  subscribeDevicePixelRatioChange,
} from "./displayMetrics.js";

export type PixiPluginOptions = {
  initOptions?: Omit<Partial<ApplicationOptions>, "resizeTo">;
  enableEditorObjectPick?: boolean;
  /**
   * When false, collider debug overlays are never created. When true (default),
   * visibility follows the editor Debug menu toggle.
   */
  enableColliderDebug?: boolean;
};

export type Viewport = ViewportController;

export type PixiPluginAPI = {
  app: Application;
  world: Container;
  viewport: Viewport;
};

type PixiPluginContext = {
  rootElement: HTMLElement;
  dispose: (fn: () => void) => void;
};

export type PixiPluginInputContext = PixiPluginContext & {
  input: {
    buttons: {
      Click: { held: boolean; pressed: boolean; released: boolean };
    };
    mouse: {
      position: { x: number; y: number } | null;
      wheel: { x: number; y: number };
    };
  };
  planck?: PlanckPluginAPI;
};

export function pixiPlugin(
  options: PixiPluginOptions = {},
): Plugin<PixiPluginInputContext, { pixi: PixiPluginAPI }> {
  return async (context) => {
    const rootElement = context.rootElement;
    rootElement.style.position = "absolute";
    rootElement.style.inset = "0";
    rootElement.style.width = "100%";
    rootElement.style.height = "100%";
    rootElement.style.overflow = "hidden";

    const app = new Application();
    await app.init({
      resizeTo: rootElement,
      autoDensity: true,
      resolution: getDevicePixelRatio(),
      antialias: true,
      preference: "webgl",
      ...options.initOptions,
    });

    rootElement.appendChild(app.canvas);

    const world = new Container();
    world.sortableChildren = true;
    app.stage.addChild(world);

    const input = context.input;
    const planck = context.planck;

    const {
      unsubscribe: unsubscribePixiSprites,
      spriteBindingsBySceneKey,
      reloadSvgTextures,
    } = pixiSprites(world);

    const colliderDebugAllowed = options.enableColliderDebug !== false;
    const colliderDebugController = colliderDebugAllowed
      ? colliderDebug(world)
      : null;
    colliderDebugController?.setEnabled(getEditorDebugUIEnabled());
    const unsubscribeColliderDebugSettings = colliderDebugController
      ? onEditorDebugUIChange(() => {
          colliderDebugController.setEnabled(getEditorDebugUIEnabled());
        })
      : null;

    const unsubscribeSelectionOverlay = selectionOverlay(
      world,
      spriteBindingsBySceneKey,
    ).unsubscribe;

    const pickEnabled = options.enableEditorObjectPick !== false;
    let shouldSuppressEditorViewport = () => false;

    const {
      viewport,
      syncViewportScreenSize,
      unsubscribe: unsubscribePixiViewport,
    } = pixiViewport({
      world,
      app,
      rootElement,
      input,
      shouldSuppressEditorViewport: () => shouldSuppressEditorViewport(),
      onEditorClickWorld: pickEnabled
        ? (worldPoint) => {
            const picked = pickSceneObjectAtWorldPoint({
              sceneContainer: world,
              worldPoint,
              spriteBindingsBySceneKey,
              planckWorld: planck?.world,
              pixelsPerMeter: planck?.pixelsPerMeter ?? 30,
            });
            if (picked) selectObject(picked);
            else deselectObject();
          }
        : undefined,
    });
    const transformGizmoOverlayController = transformGizmoOverlay(app.stage, {
      input,
      viewport,
      rootElement,
    });
    shouldSuppressEditorViewport =
      transformGizmoOverlayController.shouldSuppressViewportGesture;

    const unsubscribeDevicePixelRatio = subscribeDevicePixelRatioChange(() => {
      app.renderer.resolution = getDevicePixelRatio();
      syncViewportScreenSize();
      reloadSvgTextures();
    });

    context.dispose(() => {
      unsubscribeDevicePixelRatio();
      unsubscribeColliderDebugSettings?.();
      colliderDebugController?.unsubscribe();
      transformGizmoOverlayController.unsubscribe();
      unsubscribeSelectionOverlay();
      unsubscribePixiViewport();
      unsubscribePixiSprites();
      app.destroy(true, true);
    });

    return {
      ...context,
      pixi: {
        app,
        world,
        viewport,
      },
    };
  };
}
