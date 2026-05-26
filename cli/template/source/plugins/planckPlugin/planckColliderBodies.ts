import type { BodyType, World } from "planck";
import { getScene, type GameObject } from "gameide";
import {
  colliderSignature,
  createBodyForObject,
  isColliderNode,
  syncBodyTransformFromObject,
  type PlanckRecord,
} from "./planckBodies.js";


export function planckColliderBodies(args: {
  world: World;
  pixelsPerMeter: number;
  effectiveType: (object: GameObject) => BodyType;
}): {
  unsubscribe: () => void;
  sceneKeyToPlanckRecord: Map<PropertyKey, PlanckRecord>;
} {
  const scene = getScene();
  const sceneKeyToPlanckRecord = new Map<PropertyKey, PlanckRecord>();

  const reconcileSceneRootKey = (sceneRootKey: PropertyKey): void => {
    const maybeLiveNode = Reflect.get(scene.get(), sceneRootKey);

    const removeIfPresent = () => {
      const prevRecord = sceneKeyToPlanckRecord.get(sceneRootKey);
      if (prevRecord) {
        args.world.destroyBody(prevRecord.body);
        sceneKeyToPlanckRecord.delete(sceneRootKey);
      }
    };

    const qualifiesCollider =
      maybeLiveNode !== undefined && isColliderNode(maybeLiveNode as GameObject);
    if (!qualifiesCollider) {
      removeIfPresent();
      return;
    }

    const sceneObject = maybeLiveNode as GameObject;
    const effectiveBodyType = args.effectiveType(sceneObject);
    const nextColliderSignatureValue = colliderSignature(sceneObject, effectiveBodyType);
    if (!nextColliderSignatureValue) {
      removeIfPresent();
      return;
    }

    const existingPlanckRecord = sceneKeyToPlanckRecord.get(sceneRootKey);
    if (existingPlanckRecord?.signature === nextColliderSignatureValue) {
      syncBodyTransformFromObject(
        existingPlanckRecord.body,
        sceneObject,
        args.pixelsPerMeter,
      );
      return;
    }

    if (existingPlanckRecord) {
      args.world.destroyBody(existingPlanckRecord.body);
      sceneKeyToPlanckRecord.delete(sceneRootKey);
    }

    const createdPlanckRecord = createBodyForObject(
      args.world,
      sceneObject,
      effectiveBodyType,
      args.pixelsPerMeter,
      sceneRootKey,
    );
    if (createdPlanckRecord) {
      sceneKeyToPlanckRecord.set(sceneRootKey, createdPlanckRecord);
    }
  };

  for (const initialOwnedSceneIdentifier of Reflect.ownKeys(scene.getRaw())) {
    reconcileSceneRootKey(initialOwnedSceneIdentifier);
  }

  const unsubscribe = scene.onChange((_mutationTarget, mutationPathTrail) => {
    const anchoredSceneRootIdentifier = mutationPathTrail[0];
    if (anchoredSceneRootIdentifier === undefined) return;
    reconcileSceneRootKey(anchoredSceneRootIdentifier);
  });

  return { unsubscribe, sceneKeyToPlanckRecord };
}
