import {
  Application,
  Container,
  type ApplicationOptions,
} from "pixi.js";
import type { PlanckGameModuleAPI } from "../planckGameModule/planckGameModule.js";
import {
  deselectObject,
  getEditorDebugUIEnabled,
  onEditorDebugUIChange,
  selectObject,
  type GameModule,
  type Scene,
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

export type PixiGameModuleOptions = {
  initOptions?: Omit<Partial<ApplicationOptions>, "resizeTo">;
  enableEditorObjectPick?: boolean;
  /**
   * When false, collider debug overlays are never created. When true (default),
   * visibility follows the editor Debug menu toggle.
   */
  enableColliderDebug?: boolean;
};

export type Viewport = ViewportController;

export type PixiGameModuleAPI = {
  app: Application;
  world: Container;
  viewport: Viewport;
};

type PixiGameModuleContext = {
  rootElement: HTMLElement;
  dispose: (fn: () => void) => void;
};

export type PixiGameModuleInputContext = PixiGameModuleContext & {
  scene: Scene;
  input: {
    buttons: {
      Click: { held: boolean; pressed: boolean; released: boolean };
    };
    mouse: {
      position: { x: number; y: number } | null;
      wheel: { x: number; y: number };
    };
  };
  planck?: PlanckGameModuleAPI;
};

export function pixiGameModule(
  options: PixiGameModuleOptions = {},
): GameModule<PixiGameModuleInputContext, { pixi: PixiGameModuleAPI }> {
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

    const scene = context.scene;

    const {
      unsubscribe: unsubscribePixiSprites,
      spriteBindingsBySceneKey,
      reloadSvgTextures,
    } = pixiSprites(world, scene);

    const colliderDebugAllowed = options.enableColliderDebug !== false;
    const colliderDebugController = colliderDebugAllowed
      ? colliderDebug(world, scene)
      : null;
    colliderDebugController?.setEnabled(getEditorDebugUIEnabled());
    const unsubscribeColliderDebugSettings = colliderDebugController
      ? onEditorDebugUIChange(() => {
          colliderDebugController.setEnabled(getEditorDebugUIEnabled());
        })
      : null;

    const unsubscribeSelectionOverlay = selectionOverlay(
      world,
      scene,
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
              scene,
              sceneContainer: world,
              worldPoint,
              spriteBindingsBySceneKey,
              planckWorld: planck?.world,
              pixelsPerMeter: planck?.pixelsPerMeter ?? 30,
            });
            if (picked) selectObject(scene, picked);
            else deselectObject();
          }
        : undefined,
    });
    const transformGizmoOverlayController = transformGizmoOverlay(app.stage, scene, {
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
