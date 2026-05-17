import { Settings, Vec2, type Body, World, type BodyType } from "planck";
import { start, onGameUpdate } from "../../lifecycle/gameloop.js";
import { GameIDEMode, getMode } from "../../lifecycle/mode.js";
import type { Plugin } from "../../lifecycle/plugin.js";
import type { GameObject } from "../../scene/scene.js";
import { getScene } from "../../scene/scene.js";
import { peerIntegratesPhysicsForObject } from "../networkingPlugin/distributedSimulation.js";
import {
  sceneBodyIsDynamic,
  sceneBodyIsKinematic,
  sceneBodyIsStatic,
  getEffectivePlanckBodyType,
  getSceneBodyType,
} from "./planckBodyTypes.js";
import { getBodyData, getBodySceneKey, type PlanckRecord } from "./planckBodies.js";
import { planckColliderBodies } from "./planckColliderBodies.js";
import type { PlanckCollisionHandler } from "./planckContacts.js";
import { subscribePlanckWorldContacts } from "./planckContacts.js";
import {
  syncDynamicBodies,
  syncKinematicBodies,
  syncStaticBodies,
  type PlanckSceneSyncContext,
} from "./planckSceneSync.js";
import { wrapRigidbody2D, type Rigidbody2D } from "./rigidbody2D.js";

export {
  getSceneBodyType,
  getEffectivePlanckBodyType,
  sceneBodyIsStatic,
  sceneBodyIsKinematic,
  sceneBodyIsDynamic,
} from "./planckBodyTypes.js";

export type {
  PlanckCollisionHandler,
  PlanckCollisionInfo,
  PlanckContactPhase,
} from "./planckContacts.js";

export type PlanckPluginOptions = {
  pixelsPerMeter?: number;
  lengthUnitsPerMeter?: number;
  gravity?: { x: number; y: number };
  jitterThreshold?: number;
  simulatesDynamics?: (object: GameObject) => boolean;
};

type PlanckPluginNetworkingContext = {
  networking?: { peerId: string };
  dispose: (fn: () => void) => void;
};

export type PlanckPluginAPI = {
  world: World;
  onCollision: (self: GameObject, handler: PlanckCollisionHandler) => () => void;
  onTrigger: (self: GameObject, handler: PlanckCollisionHandler) => () => void;
  getRigidbody: (self: GameObject) => Rigidbody2D | null;
  getBody: (self: GameObject) => Body | null;
  getBodyType: (self: GameObject) => BodyType;
  isStatic: (self: GameObject) => boolean;
  isKinematic: (self: GameObject) => boolean;
  isDynamic: (self: GameObject) => boolean;
};

function positiveFiniteOrUndefined(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return undefined;
  return value;
}

function defaultSimulatesDynamics(networking: { peerId: string } | undefined) {
  if (!networking) return () => true;
  return (object: GameObject) => peerIntegratesPhysicsForObject(object, networking.peerId);
}

export function planckPlugin(
  options: PlanckPluginOptions = {},
): Plugin<PlanckPluginNetworkingContext, { planck: PlanckPluginAPI }> {
  return (context) => {
    const simulatesDynamics =
      options.simulatesDynamics ?? defaultSimulatesDynamics(context.networking);
    const effectiveType = (object: GameObject) =>
      getEffectivePlanckBodyType(object, simulatesDynamics);

    const pixelsPerMeter = positiveFiniteOrUndefined(options.pixelsPerMeter) ?? 30;
    const jitterThreshold = positiveFiniteOrUndefined(options.jitterThreshold);
    Settings.lengthUnitsPerMeter = options.lengthUnitsPerMeter ?? 1;
    const invPpm = 1 / pixelsPerMeter;

    const gravity = options.gravity ?? { x: 0, y: 0 };
    const world = new World({ gravity: new Vec2(gravity.x, gravity.y) });

    const scene = getScene();
    const { unsubscribe: unsubscribeColliderBodiesSync, sceneKeyToPlanckRecord } =
      planckColliderBodies({ world, pixelsPerMeter, effectiveType });

    const kinematicScenePosePrev = new WeakMap<
      GameObject,
      { x: number; y: number; angle: number }
    >();

    const collisionHandlers = new Map<GameObject, PlanckCollisionHandler>();
    const triggerHandlers = new Map<GameObject, Set<PlanckCollisionHandler>>();
    const unsubscribeContacts = subscribePlanckWorldContacts(world, {
      collisionHandlers,
      triggerHandlers,
    });

    const forgetHandlersForObject = (object: GameObject) => {
      collisionHandlers.delete(object);
      triggerHandlers.delete(object);
      kinematicScenePosePrev.delete(object);
    };

    const onRemoveBody = (body: Body) => {
      const owner = getBodyData(body);
      const sceneKey = getBodySceneKey(body);
      if (owner) forgetHandlersForObject(owner);
      if (sceneKey !== undefined) sceneKeyToPlanckRecord.delete(sceneKey);
    };
    world.on("remove-body", onRemoveBody);

    const syncCtxBase = (): PlanckSceneSyncContext => ({
      scene,
      sceneKeyToPlanckRecord,
      effectiveType,
      invPpm,
      pixelsPerMeter,
      jitterThreshold,
      simulatesDynamics,
      kinematicScenePosePrev,
    });

    const recordForObject = (object: GameObject): PlanckRecord | null => {
      for (const record of sceneKeyToPlanckRecord.values()) {
        if (getBodyData(record.body) === object) return record;
      }
      return null;
    };

    const onCollision = (self: GameObject, handler: PlanckCollisionHandler) => {
      collisionHandlers.set(self, handler);
      return () => {
        if (collisionHandlers.get(self) === handler) collisionHandlers.delete(self);
      };
    };

    const onTrigger = (self: GameObject, handler: PlanckCollisionHandler) => {
      let handlers = triggerHandlers.get(self);
      if (!handlers) {
        handlers = new Set();
        triggerHandlers.set(self, handlers);
      }
      handlers.add(handler);
      return () => {
        handlers?.delete(handler);
        if (handlers?.size === 0) triggerHandlers.delete(self);
      };
    };

    const api: PlanckPluginAPI = {
      world,
      onCollision,
      onTrigger,
      getRigidbody: (self) => {
        const body = recordForObject(self)?.body;
        return body ? wrapRigidbody2D(body, pixelsPerMeter) : null;
      },
      getBody: (self) => recordForObject(self)?.body ?? null,
      getBodyType: getSceneBodyType,
      isStatic: sceneBodyIsStatic,
      isKinematic: sceneBodyIsKinematic,
      isDynamic: sceneBodyIsDynamic,
    };

    context.dispose(() => {
      unsubscribeColliderBodiesSync();
      unsubscribeContacts();
      world.off("remove-body", onRemoveBody);
      let bodyList = world.getBodyList();
      while (bodyList) {
        const nextBody = bodyList.getNext();
        world.destroyBody(bodyList);
        bodyList = nextBody;
      }
      collisionHandlers.clear();
      triggerHandlers.clear();
    });

    let physicsGameUpdateRegistered = false;
    start(() => {
      if (physicsGameUpdateRegistered) return;
      physicsGameUpdateRegistered = true;
      onGameUpdate((deltaTime) => {
        if (getMode() !== GameIDEMode.Game) return;
        const clampedDeltaSeconds = Math.min(deltaTime, 0.1);
        const syncCtx = syncCtxBase();

        syncStaticBodies.beforePhysics(syncCtx);
        syncKinematicBodies.beforePhysics(syncCtx, clampedDeltaSeconds);
        syncDynamicBodies.beforePhysics(syncCtx);

        world.step(clampedDeltaSeconds, 12, 4);

        syncDynamicBodies.afterPhysics(syncCtx);
        syncStaticBodies.afterPhysics(syncCtx);
        syncKinematicBodies.afterPhysics(syncCtx);
      });
    });

    return { ...context, planck: api };
  };
}
