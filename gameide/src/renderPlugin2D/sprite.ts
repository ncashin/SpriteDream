import { Application, Assets, Sprite, Texture } from "pixi.js";
import { update } from "../gameloop.js";
import { createObjectGuard, defineObject } from "../objectRegistry.js";
import { getScene } from "../scene/scene.js";
import { TransformDefinition2D } from "./transform.js";

export const SpriteDefinition = defineObject([
  TransformDefinition2D,
  {
    sprite: {
      image: "",
      tint: "rgba(255,255,255,1)",
      width: 0,
      height: 0,
    },
  },
]);

const isSpriteRenderable = createObjectGuard(SpriteDefinition);
type GuardedBy<T> = T extends (value: unknown) => value is infer R ? R : never;
type SpriteRenderable = GuardedBy<typeof isSpriteRenderable>;

function resolveSvgResolution(): number {
  if (typeof window === "undefined") return 2;
  if (typeof window.devicePixelRatio !== "number") return 2;
  return Math.max(2, window.devicePixelRatio);
}

const svgResolution = resolveSvgResolution();

function loadTexture(url: string): Promise<Texture> {
  const base = url.split("?")[0].toLowerCase();
  if (base.endsWith(".svg")) {
    return Assets.load<Texture>({ src: url, data: { resolution: svgResolution } });
  }
  return Assets.load<Texture>(url);
}

type SpriteEntry = { sprite: Sprite; lastImage: string };

export function initializeSpriteRendering(app: Application): void {
  const scene = getScene();
  const registry = new Map<object, SpriteEntry>();

  function attach(renderable: object) {
    if (registry.has(renderable)) return;
    const sprite = new Sprite(Texture.WHITE);
    sprite.anchor.set(0.5, 0.5);
    app.stage.addChild(sprite);
    registry.set(renderable, { sprite, lastImage: "" });
  }

  function detach(renderable: object) {
    const entry = registry.get(renderable);
    if (!entry) return;
    entry.sprite.destroy();
    registry.delete(renderable);
  }

  update(() => {
    const renderables = scene.query({
      callback: isSpriteRenderable,
      cacheKey: "render2d-sprites",
    });
    const next = new Set<object>(renderables);
    for (const [obj] of registry) {
      if (!next.has(obj)) detach(obj);
    }
    for (const renderable of renderables) {
      attach(renderable);
      const entry = registry.get(renderable);
      if (entry) syncOneSprite(renderable, entry, registry);
    }
  });
}

function syncOneSprite(
  renderable: SpriteRenderable,
  entry: SpriteEntry,
  registry: Map<object, SpriteEntry>,
) {
  const { sprite } = entry;

  let image = "";
  if (typeof renderable.sprite?.image === "string" && renderable.sprite.image.length > 0) {
    image = renderable.sprite.image;
  }

  let tint = "rgba(255,255,255,1)";
  if (typeof renderable.sprite?.tint === "string" && renderable.sprite.tint.length > 0) {
    tint = renderable.sprite.tint;
  }
  sprite.tint = tint;

  if (!image) {
    sprite.texture = Texture.EMPTY;
    entry.lastImage = "";
  }
  
  if (image && entry.lastImage !== image) {
    entry.lastImage = image;
    sprite.texture = Texture.EMPTY;
    void loadTexture(image).then((texture) => {
      const stillOwned = registry.get(renderable)?.sprite === sprite;
      const stillSameImage =
        typeof renderable.sprite?.image === "string" && renderable.sprite.image === image;
      if (!stillOwned || !stillSameImage) return;
      sprite.texture = texture;
    });
  }

  const transform = renderable.transform2D;
  let rotation = 0;
  if (transform.rotation != null) rotation = transform.rotation;
  let scaleX = 1;
  if (transform.scaleX != null) scaleX = transform.scaleX;
  let scaleY = 1;
  if (transform.scaleY != null) scaleY = transform.scaleY;

  const tw = Math.max(sprite.texture.width, 1e-6);
  const th = Math.max(sprite.texture.height, 1e-6);
  let sx = scaleX;
  let sy = scaleY;
  const dw = renderable.sprite.width;
  const dh = renderable.sprite.height;
  if (typeof dw === "number" && dw > 0 && typeof dh === "number" && dh > 0) {
    sx = (dw / tw) * scaleX;
    sy = (dh / th) * scaleY;
  }

  sprite.position.set(transform.x, transform.y);
  sprite.rotation = rotation;
  sprite.scale.set(sx, -sy);
}
