import {
  Application,
  Assets,
  Container,
  Graphics,
  type ApplicationOptions,
  Point,
  Sprite,
  type Texture,
} from "pixi.js";
import { editorUpdate, gameUpdate, start, update } from "../../lifecycle/gameloop.js";
import { GameIDEMode, getMode } from "../../lifecycle/mode.js";
import type { Plugin } from "../../lifecycle/plugin.js";
import {
  deselectObject,
  selectObject,
  selectedObject,
} from "../../scene/objectSelection.js";
import type { BaseSceneObject } from "../../scene/scene.js";
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

/** Pixi sprite picking expects a `Click` button (e.g. `Mouse0`) from {@link inputPlugin}. */
export type PixiPluginInputContext = PixiPluginContext & {
  input: {
    buttons: { Click: { pressed: boolean } };
    mouse: { position: { x: number; y: number } | null };
  };
};

const SELECTION_Z = 1_000_001;
const pickScratchWorld = new Point();
const pickScratchLocal = new Point();

function pickSpriteAtWorld(
  worldX: number,
  worldY: number,
  world: Container,
  spriteByEntity: Map<SpriteRenderable, { sprite: Sprite }>,
): SpriteRenderable | null {
  const entries = [...spriteByEntity.entries()].sort(
    (a, b) => (b[1].sprite.zIndex ?? 0) - (a[1].sprite.zIndex ?? 0),
  );
  for (const [entity, { sprite }] of entries) {
    pickScratchWorld.set(worldX, worldY);
    sprite.toLocal(pickScratchWorld, world, pickScratchLocal);
    if (sprite.containsPoint(pickScratchLocal)) {
      return entity;
    }
  }
  return null;
}

function syncSpriteSelectionOutline(
  graphics: Graphics,
  selected: BaseSceneObject | null,
  spriteByEntity: Map<SpriteRenderable, { sprite: Sprite }>,
): void {
  graphics.clear();
  graphics.zIndex = SELECTION_Z;
  if (!selected) return;
  const entry = spriteByEntity.get(selected as SpriteRenderable);
  if (!entry) return;
  const sprite = entry.sprite;
  const lb = sprite.getLocalBounds();
  const t = sprite.localTransform;
  const corners: [number, number][] = [
    [lb.x, lb.y],
    [lb.x + lb.width, lb.y],
    [lb.x + lb.width, lb.y + lb.height],
    [lb.x, lb.y + lb.height],
  ];
  const p0 = t.apply({ x: corners[0]![0], y: corners[0]![1] });
  graphics.moveTo(p0.x, p0.y);
  for (let i = 1; i < 4; i++) {
    const p = t.apply({ x: corners[i]![0], y: corners[i]![1] });
    graphics.lineTo(p.x, p.y);
  }
  graphics.closePath();
  graphics.stroke({ width: 1.5, color: 0x33ccff, alpha: 0.95 });
}

type ColliderDebugState = {
  graphics: ReturnType<typeof createColliderDebugGraphics>;
  drawOptions: ColliderDebugOptions;
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

    const selectionOutline = new Graphics();
    selectionOutline.label = "gameide:spriteSelection";
    selectionOutline.eventMode = "none";
    selectionOutline.zIndex = SELECTION_Z;
    world.addChild(selectionOutline);

    const input = context.input;

    const releaseEditorPick = editorUpdate((_dt) => {
      if (disposed) return;
      syncSpriteSelectionOutline(selectionOutline, selectedObject, spriteByEntity);
      if (!input.buttons.Click.pressed) return;
      const pos = input.mouse.position;
      if (!pos) return;
      const { x: wx, y: wy } = viewport.screenToWorld(pos.x, pos.y);
      const hit = pickSpriteAtWorld(wx, wy, world, spriteByEntity);
      if (hit) selectObject(hit);
      else deselectObject();
    });

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
      releaseEditorPick();
      resizeObserver.disconnect();
      unsubscribeViewport();
      if (selectionOutline.parent === world) {
        world.removeChild(selectionOutline);
      }
      selectionOutline.destroy();
      disposePixiSprites(world, textureByKey, spriteByEntity, svgInflight);
      if (colliderDebug) {
        destroyColliderDebugGraphics(colliderDebug.graphics, world);
      }
      app.destroy(true, true);
    });

    return { ...context, pixi };
  };
}
