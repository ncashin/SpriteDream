import { Container, Sprite, Texture } from "pixi.js";
import { getScene, type ScenePath } from "../../scene/scene.js";
import {
  spriteTrait,
  type SpriteRenderable,
} from "../../trait/spriteTrait.js";
import { implementsTrait } from "../../trait/trait.js";
import { loadGraphicTexture } from "./asset.js";

type SpritePixiBinding = {
  root: Container;
  innerSprite: Sprite;
  loadGeneration: number;
};

function parseTintRGB(tintString: string): number {
  const normalized = tintString.trim();
  const tintHexMatch = /^#?([0-9a-f]{6})$/i.exec(normalized);
  return tintHexMatch ? Number.parseInt(tintHexMatch[1]!, 16) : 0xffffff;
}

function syncWorldFromSceneObject(
  binding: SpritePixiBinding,
  entity: SpriteRenderable,
) {
  binding.root.position.set(entity.position.x, entity.position.y);
  binding.root.rotation = entity.rotation.z;
  binding.root.scale.set(entity.scale.x, entity.scale.y);
  binding.innerSprite.width = entity.sprite.width;
  binding.innerSprite.height = entity.sprite.height;
  binding.innerSprite.tint = parseTintRGB(
    String(entity.sprite.tint ?? "#ffffff"),
  );
}

function scheduleTextureLoad(
  binding: SpritePixiBinding,
  entity: SpriteRenderable,
): void {
  binding.loadGeneration += 1;
  const generationAtStart = binding.loadGeneration;
  syncWorldFromSceneObject(binding, entity);
  binding.innerSprite.texture = Texture.WHITE;
  binding.innerSprite.alpha = 0.45;

  const trimmedAssetField = String(entity.sprite.asset ?? "").trim();

  void (async () => {
    try {
      if (!trimmedAssetField) {
        if (binding.loadGeneration !== generationAtStart) return;
        binding.innerSprite.texture = Texture.WHITE;
        binding.innerSprite.alpha = 0.45;
        syncWorldFromSceneObject(binding, entity);
        return;
      }

      const texture = await loadGraphicTexture(trimmedAssetField);
      if (binding.loadGeneration !== generationAtStart) return;

      binding.innerSprite.texture = texture;
      binding.innerSprite.alpha = 1;
      syncWorldFromSceneObject(binding, entity);
    } catch {
      if (binding.loadGeneration !== generationAtStart) return;
      binding.innerSprite.texture = Texture.WHITE;
      binding.innerSprite.alpha = 0.45;
      syncWorldFromSceneObject(binding, entity);
    }
  })();
}

function spriteChangeNeedsTextureReload(scenePath: ScenePath): boolean {
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

  return isTopSegmentOnly || replacesSpriteBlock || assetFieldChanged;
}

export function pixiSprites(stage: Container): {
  unsubscribe: () => void;
  spriteBindingsBySceneKey: Map<PropertyKey, SpritePixiBinding>;
} {
  const scene = getScene();
  const spriteBindingsBySceneKey = new Map<PropertyKey, SpritePixiBinding>();
  const qualifiesAsSpriteRenderable = implementsTrait([spriteTrait]);

  function removeSpriteBindingIfPresent(sceneRootKey: PropertyKey): void {
    const existingBinding = spriteBindingsBySceneKey.get(sceneRootKey);
    if (!existingBinding) return;
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
    stage.addChild(rootContainer);

    const binding: SpritePixiBinding = {
      root: rootContainer,
      innerSprite,
      loadGeneration: 0,
    };
    spriteBindingsBySceneKey.set(sceneRootKey, binding);
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

      if (spriteChangeNeedsTextureReload(mutationPathTrail)) {
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
  };
}
