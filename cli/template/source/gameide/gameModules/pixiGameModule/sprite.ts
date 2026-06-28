import { Container, Sprite, Texture } from "pixi.js";
import { z } from "zod";
import {
  defineTrait,
  implementsTrait,
  type GameObject,
  type Scene,
} from "gameide";
import { isSVGAsset, loadGraphicTexture } from "./asset.js";
import { transformSchema, transformTrait } from "../transform.js";

const spriteDataSchema = z.object({
  __icon: z.literal("image"),
  asset: z.string().default(""),
  width: z.number().default(1),
  height: z.number().default(1),
  tint: z.string().default("#ffffff"),
});

export const spriteTrait = defineTrait(
  z.object({
    sprite: spriteDataSchema.default({
      __icon: "image",
      asset: "",
      width: 1,
      height: 1,
      tint: "#ffffff",
    }),
  }),
  {
    name: "Sprite",
    description: "2D textured sprite from the project assets folder.",
    icon: "image",
  },
);

export const spriteRenderableSchema = transformSchema.merge(spriteTrait.schema);

export type SpriteRenderable = GameObject & z.infer<typeof spriteRenderableSchema>;

type ScenePath = PropertyKey[];

type SpritePixiBinding = {
  root: Container;
  innerSprite: Sprite;
  loadGeneration: number;
};

function finiteNumberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function parseTintRGB(tintString: string): number {
  const normalized = tintString.trim();
  const tintHexMatch = /^#?([0-9a-f]{6})$/i.exec(normalized);
  return tintHexMatch ? Number.parseInt(tintHexMatch[1]!, 16) : 0xffffff;
}

function isBindingActive(binding: SpritePixiBinding): boolean {
  return !binding.root.destroyed;
}

function syncWorldFromSceneObject(
  binding: SpritePixiBinding,
  entity: SpriteRenderable,
) {
  if (!isBindingActive(binding)) return;
  binding.root.position.set(
    finiteNumberOr(entity.position?.x, 0),
    finiteNumberOr(entity.position?.y, 0),
  );
  binding.root.rotation = finiteNumberOr(entity.rotation?.z, 0);
  binding.root.scale.set(
    finiteNumberOr(entity.scale?.x, 1),
    -finiteNumberOr(entity.scale?.y, 1),
  );
  binding.innerSprite.width = finiteNumberOr(entity.sprite?.width, 1);
  binding.innerSprite.height = finiteNumberOr(entity.sprite?.height, 1);
  binding.innerSprite.tint = parseTintRGB(
    String(entity.sprite?.tint ?? "#ffffff"),
  );
}

function applyPlaceholderTexture(
  binding: SpritePixiBinding,
  entity: SpriteRenderable,
): void {
  if (!isBindingActive(binding)) return;
  binding.innerSprite.texture = Texture.WHITE;
  binding.innerSprite.alpha = 0.45;
  syncWorldFromSceneObject(binding, entity);
}

function scheduleTextureLoad(
  binding: SpritePixiBinding,
  entity: SpriteRenderable,
): void {
  binding.loadGeneration += 1;
  const generationAtStart = binding.loadGeneration;
  applyPlaceholderTexture(binding, entity);

  void (async () => {
    const width = finiteNumberOr(entity.sprite?.width, 1);
    const height = finiteNumberOr(entity.sprite?.height, 1);
    const texture = await loadGraphicTexture(entity.sprite?.asset, {
      displaySize: { width, height },
    });
    if (binding.loadGeneration !== generationAtStart) return;
    if (!isBindingActive(binding)) return;

    if (!texture) {
      applyPlaceholderTexture(binding, entity);
      return;
    }

    binding.innerSprite.texture = texture;
    binding.innerSprite.alpha = 1;
    syncWorldFromSceneObject(binding, entity);
  })();
}

function spriteChangeNeedsTextureReload(
  scenePath: ScenePath,
  entity: SpriteRenderable,
): boolean {
  const secondSegment = scenePath[1];
  const thirdSegment = scenePath[2];
  const isTopSegmentOnly = scenePath.length === 1;
  const replacesSpriteBlock =
    secondSegment === "sprite" &&
    thirdSegment !== "width" &&
    thirdSegment !== "height" &&
    thirdSegment !== "tint";

  const assetFieldChanged =
    secondSegment === "sprite" &&
    scenePath.length === 3 &&
    thirdSegment === "asset";

  const svgSizeFieldChanged =
    secondSegment === "sprite" &&
    scenePath.length === 3 &&
    (thirdSegment === "width" || thirdSegment === "height") &&
    isSVGAsset(String(entity.sprite?.asset ?? ""));

  return (
    isTopSegmentOnly ||
    replacesSpriteBlock ||
    assetFieldChanged ||
    svgSizeFieldChanged
  );
}

export function pixiSprites(stage: Container, scene: Scene): {
  unsubscribe: () => void;
  spriteBindingsBySceneKey: Map<PropertyKey, SpritePixiBinding>;
  reloadSvgTextures: () => void;
} {
  const spriteBindingsBySceneKey = new Map<PropertyKey, SpritePixiBinding>();
  const qualifiesAsSpriteRenderable = implementsTrait([
    transformTrait,
    spriteTrait,
  ]);

  function removeSpriteBindingIfPresent(sceneRootKey: PropertyKey): void {
    const existingBinding = spriteBindingsBySceneKey.get(sceneRootKey);
    if (!existingBinding) return;
    existingBinding.loadGeneration += 1;
    existingBinding.root.destroy({ children: true });
    spriteBindingsBySceneKey.delete(sceneRootKey);
  }

  function createSpriteGraphicForMatchedEntity(
    sceneRootKey: PropertyKey,
    entity: SpriteRenderable,
  ): void {
    const rootContainer = new Container();
    rootContainer.label = `gameide:sprite:${String(sceneRootKey)}`;
    rootContainer.eventMode = "none";
    const innerSprite = new Sprite(Texture.WHITE);
    innerSprite.anchor.set(0.5, 0.5);
    innerSprite.eventMode = "none";
    rootContainer.addChild(innerSprite);

    const binding: SpritePixiBinding = {
      root: rootContainer,
      innerSprite,
      loadGeneration: 0,
    };
    spriteBindingsBySceneKey.set(sceneRootKey, binding);
    stage.addChild(rootContainer);
    scheduleTextureLoad(binding, entity);
  }

  function reconcileSpriteRenderableForSceneRootKey(
    sceneRootKey: PropertyKey,
  ): void {
    const maybeSceneRecord = Reflect.get(scene.getRaw(), sceneRootKey);
    const nodeQualifiesSpriteRenderableTraits =
      maybeSceneRecord !== undefined &&
      qualifiesAsSpriteRenderable(maybeSceneRecord);

    if (!nodeQualifiesSpriteRenderableTraits) {
      removeSpriteBindingIfPresent(sceneRootKey);
      return;
    }

    const typedSpriteRenderableSurface = maybeSceneRecord as SpriteRenderable;

    if (!spriteBindingsBySceneKey.has(sceneRootKey)) {
      createSpriteGraphicForMatchedEntity(sceneRootKey, typedSpriteRenderableSurface);
    }
  }

  for (const initialSceneOwnedKeyCandidate of Reflect.ownKeys(scene.getRaw())) {
    reconcileSpriteRenderableForSceneRootKey(initialSceneOwnedKeyCandidate);
  }

  function reloadSvgTextures(): void {
    for (const sceneRootKey of spriteBindingsBySceneKey.keys()) {
      const entity = Reflect.get(scene.get(), sceneRootKey) as
        | SpriteRenderable
        | undefined;
      if (!entity) continue;
      if (!isSVGAsset(String(entity.sprite?.asset ?? ""))) continue;
      const binding = spriteBindingsBySceneKey.get(sceneRootKey);
      if (binding) scheduleTextureLoad(binding, entity);
    }
  }

  const releaseSceneListenerSubscription = scene.onChange(
    (_ignoredLayerRecord, mutationPathTrail, _ignoredIncomingValue) => {
      const anchoredSceneIdentifier = mutationPathTrail[0];
      if (anchoredSceneIdentifier === undefined) return;

      const matchedSpriteRenderableBeforeThisMutation =
        spriteBindingsBySceneKey.has(anchoredSceneIdentifier);

      reconcileSpriteRenderableForSceneRootKey(anchoredSceneIdentifier);

      if (!spriteBindingsBySceneKey.has(anchoredSceneIdentifier)) return;

      const becameMatchingSpriteRenderableThisMutation =
        !matchedSpriteRenderableBeforeThisMutation;

      const spriteBindingPayload =
        spriteBindingsBySceneKey.get(anchoredSceneIdentifier);

      const shouldDeliverSpriteRenderablePropertyMutation =
        mutationPathTrail.length >= 2 ||
        !becameMatchingSpriteRenderableThisMutation;

      if (!spriteBindingPayload || !shouldDeliverSpriteRenderablePropertyMutation) {
        return;
      }

      const hydratedLiveRenderableSurface = Reflect.get(
        scene.get(),
        anchoredSceneIdentifier,
      ) as SpriteRenderable;

      if (
        spriteChangeNeedsTextureReload(
          mutationPathTrail,
          hydratedLiveRenderableSurface,
        )
      ) {
        scheduleTextureLoad(spriteBindingPayload, hydratedLiveRenderableSurface);
      } else {
        syncWorldFromSceneObject(
          spriteBindingPayload,
          hydratedLiveRenderableSurface,
        );
      }
    },
  );

  return {
    unsubscribe: releaseSceneListenerSubscription,
    spriteBindingsBySceneKey,
    reloadSvgTextures,
  };
}
