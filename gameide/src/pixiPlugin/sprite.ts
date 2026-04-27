import { Container, Sprite, Texture } from "pixi.js";
import type { IconSlug } from "../lucide/lucideIconSlug.js";
import { getScene } from "../scene/scene.js";
import {
  type DefinedTrait,
  defineTrait,
  implementsTrait,
} from "../trait/trait.js";
import { transformTrait } from "../trait/transform.js";

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

function resolveAssetUrl(
  assets: Readonly<Record<string, string>> | undefined,
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
  sprite.position.set(position.x, -position.y);
  sprite.rotation = item.rotation.z;
  sprite.scale.set(itemScale.x, itemScale.y);
  const spec = item.sprite;
  sprite.width = spec.width;
  sprite.height = spec.height;
  sprite.tint = parseHexTint(spec.tint);
  sprite.zIndex = position.z;
}

function resolveTexture(
  item: SpriteRenderable,
  url: string | undefined,
  textureByKey: Map<string, Texture>,
): { texture: Texture; signature: string } {
  const spec = item.sprite;
  const assetKey = spec.asset?.trim() ?? "";
  const sig = buildSignature(item, url);

  if (assetKey && url && isTexturableRef(assetKey)) {
    const cached = textureByKey.get(assetKey);
    if (cached) {
      return { texture: cached, signature: sig };
    }
    const next = Texture.from(url);
    textureByKey.set(assetKey, next);
    return { texture: next, signature: sig };
  }

  return { texture: Texture.WHITE, signature: sig };
}

export function syncPixiSprites(
  stage: Container,
  assets: Readonly<Record<string, string>> | undefined,
  textureByKey: Map<string, Texture>,
  spriteByEntity: Map<SpriteRenderable, { sprite: Sprite; signature: string }>,
): void {

  const syncOne = (item: SpriteRenderable): void => {
    const spec = item.sprite;
    const assetKey = spec.asset?.trim() ?? "";
    const url = resolveAssetUrl(assets, assetKey);

    const { texture, signature } = resolveTexture(item, url, textureByKey);
    const existing = spriteByEntity.get(item);

    if (existing) {
      if (existing.signature !== signature) {
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
}

