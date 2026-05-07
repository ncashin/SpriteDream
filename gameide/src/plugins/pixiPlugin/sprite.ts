import { Assets, Container, Sprite, Texture } from "pixi.js";
import type { IconSlug } from "../../lucide/lucideIconSlug.js";
import { getScene } from "../../scene/scene.js";
import {
  type DefinedTrait,
  defineTrait,
  implementsTrait,
} from "../../trait/trait.js";
import { transformTrait } from "../../trait/transform.js";

export const spriteTrait = defineTrait(
  [
    transformTrait,
    {
      sprite: {
        __icon: "image" satisfies IconSlug,
        asset: "",
        width: 1,
        height: 1,
        tint: "#ffffff",
      },
    },
  ],
  {
    name: "Sprite",
    description: "2D textured sprite from the project assets folder.",
    icon: "image" satisfies IconSlug,
  },
);

export type SpriteRenderable =
  typeof spriteTrait extends DefinedTrait<infer T> ? T : never;

function isTexturableRef(ref: string): boolean {
  const trimmed = ref.trim();
  if (trimmed.startsWith("data:")) {
    return /^data:image\//i.test(trimmed);
  }
  const path = trimmed.split(/[?#]/)[0] ?? trimmed;
  return /\.(png|jpe?g|webp|gif|bmp|ktx2|svg|avif)$/i.test(path);
}

export function isSvgAssetRef(ref: string): boolean {
  const path = ref.trim().split(/[?#]/)[0] ?? ref.trim();
  return path.toLowerCase().endsWith(".svg");
}

function hashString(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = Math.imul(h, 33) ^ s.charCodeAt(i);
  return (h >>> 0).toString(36);
}

function svgLoaderSrc(url: string, width: number, height: number, resolution: number): string {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}__gameideSvg=${width}x${height}x${resolution}`;
}

function resolveAssetUrl(
  assets: Readonly<Record<string, string>> | undefined,
  assetsBaseUrl: string | undefined,
  assetKey: string,
): string | undefined {
  if (!assetKey) return undefined;
  const fromMap = assets?.[assetKey];
  if (fromMap) return fromMap;
  const trimmedKey = assetKey.trim();
  if (
    /^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(trimmedKey) ||
    trimmedKey.startsWith("data:") ||
    trimmedKey.startsWith("blob:") ||
    trimmedKey.startsWith("/")
  ) {
    return trimmedKey;
  }
  if (assetsBaseUrl && trimmedKey) {
    const base = assetsBaseUrl.endsWith("/") ? assetsBaseUrl : `${assetsBaseUrl}/`;
    const pathPart = trimmedKey.replace(/^assets\//, "");
    try {
      return new URL(pathPart, base).href;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function parseHexTint(tint: string): number {
  const hex = tint.trim();
  if (!hex.startsWith("#") || hex.length < 2) {
    return 0xffffff;
  }
  const parsed = parseInt(hex.slice(1), 16);
  if (!Number.isFinite(parsed)) return 0xffffff;
  return parsed & 0xffffff;
}

function buildSignature(item: SpriteRenderable, url: string | undefined): string {
  const spec = item.sprite;
  const assetKey = spec.asset?.trim() ?? "";
  return `${assetKey}|${url ?? ""}|${spec.width}|${spec.height}|${spec.tint}`;
}

function setSpriteFromItem(sprite: Sprite, item: SpriteRenderable): void {
  const position = item.position;
  const itemScale = item.scale;
  // Match planckPlugin: transform `position` is the body/collider center, not a corner.
  sprite.anchor.set(0.5, 0.5);
  sprite.position.set(position.x, position.y);
  sprite.rotation = item.rotation.z;
  sprite.scale.set(itemScale.x, itemScale.y);
  const spec = item.sprite;
  sprite.width = spec.width;
  sprite.height = spec.height;
  // World container uses scale.y < 0 (scene +Y up); flip local Y so textures aren’t mirrored.
  sprite.scale.y *= -1;
  sprite.tint = parseHexTint(spec.tint);
  sprite.zIndex = position.z;
}

export type SyncPixiSpritesOptions = {
  textureResolution?: number;
  svgInflight?: Map<string, Promise<void>>;
};

function resolveTexture(
  item: SpriteRenderable,
  url: string | undefined,
  textureByKey: Map<string, Texture>,
  syncOptions: SyncPixiSpritesOptions | undefined,
): { texture: Texture; signature: string } {
  const spec = item.sprite;
  const assetKey = spec.asset?.trim() ?? "";
  const sig = buildSignature(item, url);

  if (!(assetKey && url && isTexturableRef(assetKey))) {
    return { texture: Texture.WHITE, signature: sig };
  }

  const res = syncOptions?.textureResolution ?? 1;
  const rw = Math.max(1, Math.round(spec.width));
  const rh = Math.max(1, Math.round(spec.height));

  if (isSvgAssetRef(assetKey)) {
    const svgKey = `${assetKey}|${rw}|${rh}|${res}`;
    const cached = textureByKey.get(svgKey);
    if (cached) {
      return { texture: cached, signature: sig };
    }
    const inflight = syncOptions?.svgInflight;
    if (inflight && !inflight.has(svgKey)) {
      const alias = `__gameideSvg_${hashString(svgKey)}`;
      const uniqueSrc = svgLoaderSrc(url, rw, rh, res);
      const load = Assets.load({
        alias,
        src: uniqueSrc,
        data: {
          width: rw,
          height: rh,
          resolution: res,
        },
      })
        .then((texture) => {
          textureByKey.set(svgKey, texture as Texture);
        })
        .catch((err) => {
          console.error("[gameide] failed to rasterize SVG", assetKey, err);
        })
        .finally(() => {
          inflight.delete(svgKey);
        });
      inflight.set(svgKey, load.then(() => {}));
    }
    return { texture: textureByKey.get(svgKey) ?? Texture.WHITE, signature: sig };
  }

  const cached = textureByKey.get(assetKey);
  if (cached) {
    return { texture: cached, signature: sig };
  }
  const next = Texture.from(url);
  textureByKey.set(assetKey, next);
  return { texture: next, signature: sig };
}

export function syncPixiSprites(
  stage: Container,
  assets: Readonly<Record<string, string>> | undefined,
  assetsBaseUrl: string | undefined,
  textureByKey: Map<string, Texture>,
  spriteByEntity: Map<SpriteRenderable, { sprite: Sprite; signature: string }>,
  syncOptions?: SyncPixiSpritesOptions,
): void {

  const syncOne = (item: SpriteRenderable): void => {
    const spec = item.sprite;
    const assetKey = spec.asset?.trim() ?? "";
    const url = resolveAssetUrl(assets, assetsBaseUrl, assetKey);

    const { texture, signature } = resolveTexture(item, url, textureByKey, syncOptions);
    const existing = spriteByEntity.get(item);

    if (existing) {
      if (existing.signature !== signature || existing.sprite.texture !== texture) {
        existing.sprite.texture = texture;
        existing.signature = signature;
      }
      setSpriteFromItem(existing.sprite, item);
      return;
    }

    const sprite = new Sprite(texture);
    setSpriteFromItem(sprite, item);
    stage.addChild(sprite);
    spriteByEntity.set(item, { sprite, signature });
  };

  const list = getScene().query(implementsTrait(spriteTrait));
  const active = new Set<SpriteRenderable>();
  for (const item of list) {
    active.add(item);
    syncOne(item);
  }
  for (const [entity, { sprite }] of spriteByEntity.entries()) {
    if (active.has(entity)) continue;
    stage.removeChild(sprite);
    sprite.destroy();
    spriteByEntity.delete(entity);
  }
}

export function disposePixiSprites(
  stage: Container,
  textureByKey: Map<string, Texture>,
  spriteByEntity: Map<SpriteRenderable, { sprite: Sprite; signature: string }>,
  svgInflight?: Map<string, Promise<void>>,
): void {
  for (const { sprite } of spriteByEntity.values()) {
    stage.removeChild(sprite);
    sprite.destroy();
  }
  spriteByEntity.clear();
  for (const texture of textureByKey.values()) {
    texture.destroy(true);
  }
  textureByKey.clear();
  svgInflight?.clear();
}

