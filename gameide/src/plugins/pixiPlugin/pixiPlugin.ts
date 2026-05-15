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
import { onEditorUpdate, onGameUpdate, start, update } from "../../lifecycle/gameloop.js";
import { GameIDEMode, getMode, onModeChange } from "../../lifecycle/mode.js";
import type { Plugin } from "../../lifecycle/plugin.js";
import {
  deselectObject,
  selectObject,
  selectedObject,
} from "../../scene/objectSelection.js";
import type { GameObject } from "../../scene/scene.js";
import {
  createColliderDebugGraphics,
  destroyColliderDebugGraphics,
  type ColliderDebugOptions,
  syncColliderDebugDraw,
} from "./colliderDebug.js";
import { disposePixiSprites, spriteTrait, syncPixiSprites, type SpriteRenderable } from "./sprite.js";
import {
  drawActiveTransformGizmo,
  hitTestMoveGizmo,
  hitTestRotateGizmo,
  hitTestScaleGizmo,
  UNIFORM_SCALE_COLOR,
  type MoveGizmoHit,
  type RotateGizmoHit,
  type ScaleGizmoHit,
} from "./transformGizmoPixi.js";
import {
  getTransformGizmoTool,
  type TransformGizmoTool,
} from "../editorPlugin/transformGizmoTool.js";
import { implementsTrait } from "../../trait/trait.js";
import {
  applyViewportToWorldContainer,
  createEditorViewportGestureState,
  createViewport,
  editorViewportEditorFrame,
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

/** Pixi: sprite pick and editor viewport use `Click` / `Mouse0` from {@link inputPlugin} with `mouseHandling: "editor"`. */
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
};

const SELECTION_Z = 1_000_001;
const GIZMO_Z = SELECTION_Z + 2;

type ActiveGizmoDrag =
  | {
      tool: "translate";
      kind: "x" | "y" | "xy";
      startObjX: number;
      startObjY: number;
      anchorWx: number;
      anchorWy: number;
    }
  | {
      tool: "rotate";
      pivotX: number;
      pivotY: number;
      startRotZ: number;
      anchorAngle: number;
    }
  | {
      tool: "scale";
      kind: "x" | "y" | "xy";
      pivotX: number;
      pivotY: number;
      startScaleX: number;
      startScaleY: number;
      anchorWx: number;
      anchorWy: number;
    };
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
  selected: GameObject | null,
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
  graphics.stroke({ width: 1.5, color: UNIFORM_SCALE_COLOR, alpha: 0.95 });
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

    const transformGizmoGfx = new Graphics();
    transformGizmoGfx.label = "gameide:transformGizmo";
    transformGizmoGfx.eventMode = "none";
    transformGizmoGfx.zIndex = GIZMO_Z;
    world.addChild(transformGizmoGfx);

    const input = context.input;
    const editorViewportGesture = createEditorViewportGestureState();

    let gizmoDrag: ActiveGizmoDrag | null = null;

    const resetViewportForModeChange = (): void => {
      viewport.setCenter(0, 0);
      viewport.setScale(1);
      editorViewportGesture.panning = false;
      editorViewportGesture.anchorWorld = null;
      editorViewportGesture.pressClient = null;
      gizmoDrag = null;
    };

    const releaseModeViewportReset = onModeChange(resetViewportForModeChange);

    const syncTransformGizmoOverlay = (
      tool: TransformGizmoTool,
      moveH: MoveGizmoHit,
      rotateH: RotateGizmoHit,
      scaleH: ScaleGizmoHit,
    ): void => {
      transformGizmoGfx.clear();
      const select = selectedObject;
      const inEditor = getMode() === GameIDEMode.Editor;
      if (!inEditor || !select || !implementsTrait([spriteTrait])(select)) return;
      if (!spriteByEntity.has(select as SpriteRenderable)) return;
      const pos = (select as SpriteRenderable).position;
      transformGizmoGfx.position.set(pos.x, pos.y);
      transformGizmoGfx.zIndex = GIZMO_Z;
      drawActiveTransformGizmo(
        transformGizmoGfx,
        viewport.state.scale,
        tool,
        moveH,
        rotateH,
        scaleH,
      );
    };

    const releaseEditorPick = onEditorUpdate((_dt) => {
      if (disposed) return;
      syncSpriteSelectionOutline(selectionOutline, selectedObject, spriteByEntity);

      const pos = input.mouse.position;
      const vScale = viewport.state.scale;
      let skipViewport = false;
      let moveHover: MoveGizmoHit = "none";
      let rotateHover: RotateGizmoHit = "none";
      let scaleHover: ScaleGizmoHit = "none";

      const editorMode = getMode() === GameIDEMode.Editor;
      const gizmoTool = getTransformGizmoTool();
      const spriteSel =
        editorMode &&
        selectedObject &&
        implementsTrait([spriteTrait])(selectedObject) &&
        spriteByEntity.has(selectedObject as SpriteRenderable)
          ? (selectedObject as SpriteRenderable)
          : null;

      if (gizmoDrag && gizmoDrag.tool !== gizmoTool) {
        gizmoDrag = null;
      }

      if (gizmoDrag) {
        skipViewport = true;
        const sel =
          selectedObject &&
          implementsTrait([spriteTrait])(selectedObject) &&
          spriteByEntity.has(selectedObject as SpriteRenderable)
            ? (selectedObject as SpriteRenderable)
            : null;
        if (pos && sel && input.buttons.Click.held) {
          const w = viewport.screenToWorld(pos.x, pos.y);
          if (gizmoDrag.tool === "translate") {
            moveHover = gizmoDrag.kind;
            if (gizmoDrag.kind === "x") {
              sel.position.x = gizmoDrag.startObjX + (w.x - gizmoDrag.anchorWx);
            } else if (gizmoDrag.kind === "y") {
              sel.position.y = gizmoDrag.startObjY + (w.y - gizmoDrag.anchorWy);
            } else {
              sel.position.x = gizmoDrag.startObjX + (w.x - gizmoDrag.anchorWx);
              sel.position.y = gizmoDrag.startObjY + (w.y - gizmoDrag.anchorWy);
            }
          } else if (gizmoDrag.tool === "rotate") {
            rotateHover = "z";
            const ang = Math.atan2(w.y - gizmoDrag.pivotY, w.x - gizmoDrag.pivotX);
            sel.rotation.z = gizmoDrag.startRotZ + (ang - gizmoDrag.anchorAngle);
          } else {
            scaleHover = gizmoDrag.kind;
            const px = gizmoDrag.pivotX;
            const py = gizmoDrag.pivotY;
            if (gizmoDrag.kind === "x") {
              const ax0 = Math.abs(gizmoDrag.anchorWx - px);
              const ax1 = Math.abs(w.x - px);
              const f = ax0 > 1e-10 ? ax1 / ax0 : 1;
              sel.scale.x = Math.max(0.02, gizmoDrag.startScaleX * f);
            } else if (gizmoDrag.kind === "y") {
              const ay0 = Math.abs(gizmoDrag.anchorWy - py);
              const ay1 = Math.abs(w.y - py);
              const f = ay0 > 1e-10 ? ay1 / ay0 : 1;
              sel.scale.y = Math.max(0.02, gizmoDrag.startScaleY * f);
            } else {
              const d0 =
                Math.abs(gizmoDrag.anchorWx - px) + Math.abs(gizmoDrag.anchorWy - py);
              const d1 = Math.abs(w.x - px) + Math.abs(w.y - py);
              const f = d0 > 1e-10 ? d1 / d0 : 1;
              sel.scale.x = Math.max(0.02, gizmoDrag.startScaleX * f);
              sel.scale.y = Math.max(0.02, gizmoDrag.startScaleY * f);
            }
          }
        }
        if (input.buttons.Click.released) {
          gizmoDrag = null;
        }
      } else if (editorMode && input.buttons.Click.pressed && pos && spriteSel) {
        const pivot = spriteSel.position;
        const w = viewport.screenToWorld(pos.x, pos.y);

        if (gizmoTool === "translate") {
          const hit = hitTestMoveGizmo(w.x, w.y, pivot.x, pivot.y, vScale);
          if (hit !== "none") {
            skipViewport = true;
            const kind = hit === "xy" ? "xy" : hit;
            gizmoDrag = {
              tool: "translate",
              kind,
              startObjX: pivot.x,
              startObjY: pivot.y,
              anchorWx: w.x,
              anchorWy: w.y,
            };
            moveHover = hit;
          }
        } else if (gizmoTool === "rotate") {
          const hit = hitTestRotateGizmo(w.x, w.y, pivot.x, pivot.y, vScale);
          if (hit === "z") {
            skipViewport = true;
            const ang = Math.atan2(w.y - pivot.y, w.x - pivot.x);
            gizmoDrag = {
              tool: "rotate",
              pivotX: pivot.x,
              pivotY: pivot.y,
              startRotZ: spriteSel.rotation.z,
              anchorAngle: ang,
            };
            rotateHover = "z";
          }
        } else {
          const hit = hitTestScaleGizmo(w.x, w.y, pivot.x, pivot.y, vScale);
          if (hit !== "none") {
            skipViewport = true;
            const kind = hit === "xy" ? "xy" : hit;
            gizmoDrag = {
              tool: "scale",
              kind,
              pivotX: pivot.x,
              pivotY: pivot.y,
              startScaleX: spriteSel.scale.x,
              startScaleY: spriteSel.scale.y,
              anchorWx: w.x,
              anchorWy: w.y,
            };
            scaleHover = hit;
          }
        }
      }

      let shouldPickAtClick = false;
      if (!skipViewport) {
        const frame = editorViewportEditorFrame(editorViewportGesture, {
          rootElement,
          viewport,
          panButton: input.buttons.Click,
          clientPosition: pos,
          wheel: input.mouse.wheel,
        });
        shouldPickAtClick = frame.shouldPickAtClick;
      }

      if (!gizmoDrag && pos && spriteSel) {
        const pivot = spriteSel.position;
        const w = viewport.screenToWorld(pos.x, pos.y);
        if (gizmoTool === "translate") {
          moveHover = hitTestMoveGizmo(w.x, w.y, pivot.x, pivot.y, vScale);
        } else if (gizmoTool === "rotate") {
          rotateHover = hitTestRotateGizmo(w.x, w.y, pivot.x, pivot.y, vScale);
        } else {
          scaleHover = hitTestScaleGizmo(w.x, w.y, pivot.x, pivot.y, vScale);
        }
      }

      syncTransformGizmoOverlay(gizmoTool, moveHover, rotateHover, scaleHover);

      if (!shouldPickAtClick) return;
      if (!pos) return;
      const { x: wx, y: wy } = viewport.screenToWorld(pos.x, pos.y);
      const hitSprite = pickSpriteAtWorld(wx, wy, world, spriteByEntity);
      if (hitSprite) selectObject(hitSprite);
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
      onGameUpdate(() => {
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
      releaseModeViewportReset();
      releaseEditorPick();
      resizeObserver.disconnect();
      unsubscribeViewport();
      if (selectionOutline.parent === world) {
        world.removeChild(selectionOutline);
      }
      selectionOutline.destroy();
      if (transformGizmoGfx.parent === world) {
        world.removeChild(transformGizmoGfx);
      }
      transformGizmoGfx.destroy();
      disposePixiSprites(world, textureByKey, spriteByEntity, svgInflight);
      if (colliderDebug) {
        destroyColliderDebugGraphics(colliderDebug.graphics, world);
      }
      app.destroy(true, true);
    });

    return { ...context, pixi };
  };
}
