import {
  Application,
  Container,
  type ApplicationOptions,
} from "pixi.js";
import type { PlanckPluginAPI } from "../planckPlugin/planckPlugin.js";
import { selectObject, type Plugin } from "gameide";
import { pickSceneObjectAtWorldPoint } from "./editorPick.js";
import { pixiSprites } from "./sprite.js";
import {
  type ViewportController,
  pixiViewport,
} from "./viewport.js";
import { colliderDebug } from "./colliderDebug.js";
import { selectionOverlay } from "./selectionOverlay.js";
import { transformGizmoOverlay } from "./transformGizmoOverlay.js";

export type PixiPluginOptions = {
  initOptions?: Omit<Partial<ApplicationOptions>, "resizeTo">;
  enableEditorObjectPick?: boolean;
  /** When true (default), draws collider outlines in scene pixel units. */
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

    const { unsubscribe: unsubscribePixiSprites, spriteBindingsBySceneKey } =
      pixiSprites(world);

    const colliderDebugEnabled = options.enableColliderDebug !== false;
    const unsubscribeColliderDebug = colliderDebugEnabled
      ? colliderDebug(world).unsubscribe
      : null;

    const unsubscribeSelectionOverlay = selectionOverlay(
      world,
      spriteBindingsBySceneKey,
    ).unsubscribe;

    const pickEnabled = options.enableEditorObjectPick !== false;
    let shouldSuppressEditorViewport = () => false;

    const { viewport, unsubscribe: unsubscribePixiViewport } = pixiViewport({
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
          }
        : undefined,
    });
    const transformGizmoOverlayController = transformGizmoOverlay(world, {
      input,
      viewport,
    });
    shouldSuppressEditorViewport =
      transformGizmoOverlayController.shouldSuppressViewportGesture;

    context.dispose(() => {
      unsubscribeColliderDebug?.();
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
