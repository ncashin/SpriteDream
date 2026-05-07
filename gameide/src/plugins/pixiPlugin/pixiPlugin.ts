import {
  Application,
  Assets,
  Container,
  type ApplicationOptions,
  Sprite,
  type Texture,
} from "pixi.js";
import { gameUpdate, start, update } from "../../lifecycle/gameloop.js";
import { GameIDEMode, getMode } from "../../lifecycle/mode.js";
import type { Plugin } from "../../lifecycle/plugin.js";
import {
  createColliderDebugGraphics,
  destroyColliderDebugGraphics,
  type ColliderDebugOptions,
  syncColliderDebugDraw,
} from "./colliderDebug.js";
import { disposePixiSprites, syncPixiSprites, type SpriteRenderable } from "./sprite.js";
import {
  applyViewportToWorldContainer,
  createViewport,
} from "./viewport.js";

export type PixiPluginOptions = {
  initOptions?: Omit<Partial<ApplicationOptions>, "resizeTo">;
  debugDrawColliders?: boolean | ColliderDebugOptions;
};

function defaultAssetsBaseUrl(): string | undefined {
  if (typeof globalThis.location?.href !== "string") return undefined;
  const base =
    typeof import.meta.env?.BASE_URL === "string" ? import.meta.env.BASE_URL : "/";
  try {
    return new URL(`${base}assets/`, globalThis.location.href).href;
  } catch {
    return undefined;
  }
}

export type Viewport = ReturnType<typeof createViewport>;

export type PixiPluginAPI = {
  app: Application;
  world: Container;
  viewport: Viewport;
};

type PixiPluginContext = {
  rootElement: HTMLElement;
  dispose: (fn: () => void) => void;
};

type ColliderDebugState = {
  graphics: ReturnType<typeof createColliderDebugGraphics>;
  drawOptions: ColliderDebugOptions;
};

export function pixiPlugin(
  options: PixiPluginOptions = {},
): Plugin<PixiPluginContext, { pixi: PixiPluginAPI }> {
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

    await Assets.init();
    const assetsBaseUrl = defaultAssetsBaseUrl();

    let disposed = false;

    const world = new Container();
    world.sortableChildren = true;
    app.stage.addChild(world);

    const viewport = createViewport(app.screen.width, app.screen.height, {
      rootElement,
    });
    const unsubscribeViewport = viewport.onChange((next) => {
      if (disposed) return;
      applyViewportToWorldContainer(world, next);
    });

    const resizeObserver = new ResizeObserver(() => {
      const w = rootElement.clientWidth;
      const h = rootElement.clientHeight;
      if (w > 0 && h > 0) {
        app.resize();
        viewport.setScreenSize(w, h);
      }
    });
    resizeObserver.observe(rootElement);

    const textureByKey = new Map<string, Texture>();
    const spriteByEntity = new Map<SpriteRenderable, { sprite: Sprite; signature: string }>();
    const svgInflight = new Map<string, Promise<void>>();

    const colliderDebugOption = options.debugDrawColliders;
    let resolvedColliderDebugOptions: ColliderDebugOptions | undefined;
    if (colliderDebugOption === true) {
      resolvedColliderDebugOptions = {};
    } else if (colliderDebugOption != null && colliderDebugOption !== false) {
      resolvedColliderDebugOptions = colliderDebugOption;
    }

    let colliderDebug: ColliderDebugState | null = null;
    if (resolvedColliderDebugOptions !== undefined) {
      const drawOptions = resolvedColliderDebugOptions;
      colliderDebug = {
        graphics: createColliderDebugGraphics(world, drawOptions),
        drawOptions,
      };
    }

    const syncFrame = () => {
      syncPixiSprites(world, undefined, assetsBaseUrl, textureByKey, spriteByEntity, {
        textureResolution: app.renderer.resolution,
        svgInflight,
      });
      if (colliderDebug) {
        syncColliderDebugDraw(world, colliderDebug.graphics, colliderDebug.drawOptions);
      }
    };

    update(() => {
      if (disposed) return;
      if (getMode() === GameIDEMode.Game) return;
      syncFrame();
    });

    let pixiGameUpdateRegistered = false;
    start(() => {
      if (pixiGameUpdateRegistered) return;
      pixiGameUpdateRegistered = true;
      gameUpdate(() => {
        if (disposed || getMode() !== GameIDEMode.Game) return;
        syncFrame();
      });
    });

    const pixi: PixiPluginAPI = {
      app,
      world,
      viewport,
    };

    context.dispose(() => {
      disposed = true;
      resizeObserver.disconnect();
      unsubscribeViewport();
      disposePixiSprites(world, textureByKey, spriteByEntity, svgInflight);
      if (colliderDebug) {
        destroyColliderDebugGraphics(colliderDebug.graphics, world);
      }
      app.destroy(true, true);
    });

    return { ...context, pixi };
  };
}
