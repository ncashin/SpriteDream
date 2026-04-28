/**
 * Planck (Box2D) integration for the scene graph.
 *
 * **Setup:** Add {@link collisionBodyTrait} plus {@link boxColliderTrait} or {@link circleColliderTrait}
 * to objects. Collider-only objects default to a static body (good for walls).
 *
 * **Each frame**
 * 1. `update` — Match bodies to colliders in the scene (create / destroy / rebuild on signature change).
 * 2. `gameUpdate` — Push transform from scene → Planck for static & kinematic bodies, push
 *    `collisionBody.velocity` → Planck for dynamic bodies, step the world, then copy
 *    dynamic transforms and velocities back onto scene objects. Game code should register `gameUpdate`
 *    before the physics step runs (registration is deferred via `start` for that reason).
 *
 * **Multiplayer:** With `networkingPlugin` before this plugin, authored `dynamic` bodies whose
 * `__ownerId` is another peer are created as **kinematic** and follow replicated scene state so only
 * the owner integrates physics. Override with {@link PlanckPluginOptions.simulatesDynamics}.
 *
 * **Callbacks:** `onCollision` is solid contact; `onTrigger` fires when either fixture is a sensor.
 */
import {
  type Body,
  type BodyType,
  type Contact,
  Settings,
  World,
  Vec2,
} from "planck";
import { update, start, gameUpdate } from "../lifecycle/gameloop.js";
import type { Plugin } from "../lifecycle/plugin.js";
import type { BaseSceneObject } from "../scene/scene.js";
import { getScene } from "../scene/scene.js";
import { query } from "../scene/query/query.js";
import {
  getEffectivePlanckBodyType,
  getSceneBodyType,
  sceneBodyIsDynamic,
  sceneBodyIsKinematic,
  sceneBodyIsStatic,
} from "./physicsTypes.js";
import {
  colliderSignature,
  createBodyForObject,
  getBodyData,
  isColliderNode,
  sceneVec,
  type PlanckRecord,
} from "./planckBodies.js";
import { wrapRigidbody2D, type Rigidbody2D } from "./rigidbody2d.js";

export type PlanckPluginOptions = {
  /**
   * Planck multiplies Box2D internal length tolerances by this (global {@link Settings.lengthUnitsPerMeter}).
   * Defaults to `64`: MKS defaults assume ~meters while common games use pixels as scene units (~hundreds px/s).
   * Without scaling, the solver caps |v·dt| per step near ~2 pixels — a hard speed limit and coupled axes (moving
   * sideways reduces how fast you can fall). Set higher if you use very fast projectiles or large timestep spikes.
   */
  lengthUnitsPerMeter?: number;
  /** In scene units per second²; scene +Y is up (negative y pulls downward). Default `{ x: 0, y: 0 }` (top-down). */
  gravity?: { x: number; y: number };
  /**
   * If false while the scene body type is `dynamic`, Planck uses a kinematic body driven from the scene
   * (e.g. replicated transforms). Defaults to `networking.simulatesPhysics` when `networkingPlugin` ran first.
   */
  simulatesDynamics?: (obj: BaseSceneObject) => boolean;
};

type PlanckPluginNetworkingContext = {
  networking?: { simulatesPhysics: (obj: BaseSceneObject) => boolean };
};

export type PlanckContactPhase = "enter" | "exit";

export type PlanckCallbackEvent = { phase: PlanckContactPhase };

/** Callback for {@link PlanckPluginAPI.onCollision} and {@link PlanckPluginAPI.onTrigger}. */
export type PlanckCollisionHandler = (
  other: BaseSceneObject,
  e: PlanckCallbackEvent,
) => void;

export type PlanckPluginAPI = {
  world: World;
  /** Unity-style: solid contact (neither side is a trigger). `self` and `other` are scene object references. */
  onCollision: (self: BaseSceneObject, handler: PlanckCollisionHandler) => () => void;
  /** Unity-style: overlap when at least one fixture is a `isTrigger` collider. */
  onTrigger: (self: BaseSceneObject, handler: PlanckCollisionHandler) => () => void;
  /**
   * Unity-style rigidbody for this object after the physics plugin has created a body (same frame as `gameUpdate` after sync).
   * Prefer this over {@link getBody} in game code.
   */
  getRigidbody: (self: BaseSceneObject) => Rigidbody2D | null;
  /** Raw Planck body — escape hatch for joints and low-level APIs. */
  getBody: (self: BaseSceneObject) => Body | null;
  /** Authored/scene body type (defaults to `static` if `collisionBody` is omitted). */
  getBodyType: (self: BaseSceneObject) => BodyType;
  isStatic: (self: BaseSceneObject) => boolean;
  isKinematic: (self: BaseSceneObject) => boolean;
  isDynamic: (self: BaseSceneObject) => boolean;
  /** Stop stepping and clear listeners. */
  dispose: () => void;
};

export function planckPlugin(
  options: PlanckPluginOptions = {},
): Plugin<PlanckPluginNetworkingContext, { planck: PlanckPluginAPI }> {
  return (context) => {
    const simulatesDynamics =
      options.simulatesDynamics ??
      context.networking?.simulatesPhysics ??
      (() => true);

    const effectiveType = (obj: BaseSceneObject) =>
      getEffectivePlanckBodyType(obj, simulatesDynamics);
    Settings.lengthUnitsPerMeter = options.lengthUnitsPerMeter ?? 64;
    const g = options.gravity ?? { x: 0, y: 0 };
    const world = new World({
      gravity: sceneVec(g.x, g.y),
    });

    const objectToRecord = new Map<BaseSceneObject, PlanckRecord>();
    const collisionHandlers = new Map<BaseSceneObject, Set<PlanckCollisionHandler>>();
    const triggerHandlers = new Map<BaseSceneObject, Set<PlanckCollisionHandler>>();

    const addHandler = (
      map: Map<BaseSceneObject, Set<PlanckCollisionHandler>>,
      self: BaseSceneObject,
      handler: PlanckCollisionHandler,
    ) => {
      let set = map.get(self);
      if (!set) {
        set = new Set();
        map.set(self, set);
      }
      set.add(handler);
      return () => {
        set?.delete(handler);
        if (set && set.size === 0) {
          map.delete(self);
        }
      };
    };

    const notifyContactHandlers = (
      map: Map<BaseSceneObject, Set<PlanckCollisionHandler>>,
      self: BaseSceneObject,
      other: BaseSceneObject,
      phase: PlanckContactPhase,
    ) => {
      const set = map.get(self);
      if (!set) return;
      for (const fn of set) {
        try {
          fn(other, { phase });
        } catch (err) {
          console.error("planckPlugin handler error", err);
        }
      }
    };

    const runContact = (contact: Contact, phase: PlanckContactPhase) => {
      const bodyA = contact.getFixtureA().getBody();
      const bodyB = contact.getFixtureB().getBody();
      const a = getBodyData(bodyA);
      const b = getBodyData(bodyB);
      if (!a || !b || a === b) return;
      const fa = contact.getFixtureA();
      const fb = contact.getFixtureB();
      const isTrigger = fa.isSensor() || fb.isSensor();
      if (isTrigger) {
        notifyContactHandlers(triggerHandlers, a, b, phase);
        notifyContactHandlers(triggerHandlers, b, a, phase);
      } else {
        notifyContactHandlers(collisionHandlers, a, b, phase);
        notifyContactHandlers(collisionHandlers, b, a, phase);
      }
    };

    const onBegin = (c: Contact) => runContact(c, "enter");
    const onEnd = (c: Contact) => runContact(c, "exit");

    world.on("begin-contact", onBegin);
    world.on("end-contact", onEnd);
    const onRemoveBody = (b: Body) => {
      const o = getBodyData(b);
      if (o) {
        objectToRecord.delete(o);
      }
    };
    world.on("remove-body", onRemoveBody);

    /** Add/update/remove Planck bodies so they match current collider objects in the scene. */
    const syncBodiesWithScene = () => {
      const scene = getScene();
      const colliders = query(scene, isColliderNode);
      const alive = new Set<BaseSceneObject>();

      for (const obj of colliders) {
        alive.add(obj);
        const eff = effectiveType(obj);
        const nextSig = colliderSignature(obj, eff);
        if (!nextSig) continue;
        const rec = objectToRecord.get(obj);
        if (rec) {
          if (rec.signature === nextSig) continue;
          world.destroyBody(rec.body);
        }
        const next = createBodyForObject(world, obj, eff);
        if (next) {
          objectToRecord.set(obj, next);
        }
      }

      const toRemove: BaseSceneObject[] = [];
      for (const obj of objectToRecord.keys()) {
        if (!alive.has(obj)) toRemove.push(obj);
      }
      for (const obj of toRemove) {
        const rec = objectToRecord.get(obj);
        if (rec) {
          world.destroyBody(rec.body);
        }
        objectToRecord.delete(obj);
      }
    };

    const syncKinematicAndStaticFromScene = () => {
      for (const [obj, rec] of objectToRecord) {
        const t = effectiveType(obj);
        if (t !== "static" && t !== "kinematic") continue;
        const pos = (obj as { position: { x: number; y: number } }).position;
        const rotZ = (obj as { rotation: { z: number } }).rotation.z;
        rec.body.setTransform(sceneVec(pos.x, pos.y), rotZ);
      }
    };

    const syncDynamicVelocityFromScene = () => {
      for (const [obj, rec] of objectToRecord) {
        if (effectiveType(obj) !== "dynamic") continue;
        const vel =
          (obj as { collisionBody?: { velocity?: { x: number; y: number } } }).collisionBody
            ?.velocity ?? { x: 0, y: 0 };
        rec.body.setLinearVelocity(new Vec2(vel.x, vel.y));
      }
    };

    const syncDynamicBodiesToScene = () => {
      for (const [obj, rec] of objectToRecord) {
        if (effectiveType(obj) !== "dynamic") continue;
        const p = rec.body.getPosition();
        const a = rec.body.getAngle();
        const v = rec.body.getLinearVelocity();
        (obj as { position: { x: number; y: number } }).position.x = p.x;
        (obj as { position: { x: number; y: number } }).position.y = p.y;
        (obj as { rotation: { z: number } }).rotation.z = a;
        const cb = (obj as { collisionBody?: { velocity?: { x: number; y: number } } }).collisionBody;
        if (cb) {
          if (!cb.velocity) cb.velocity = { x: 0, y: 0 };
          cb.velocity.x = v.x;
          cb.velocity.y = v.y;
        }
      }
    };

    const api: PlanckPluginAPI = {
      world,
      onCollision: (self, handler) => addHandler(collisionHandlers, self, handler),
      onTrigger: (self, handler) => addHandler(triggerHandlers, self, handler),
      getRigidbody: (self) => {
        const b = objectToRecord.get(self)?.body;
        return b ? wrapRigidbody2D(b) : null;
      },
      getBody: (self) => objectToRecord.get(self)?.body ?? null,
      getBodyType: (self) => getSceneBodyType(self),
      isStatic: (self) => sceneBodyIsStatic(self),
      isKinematic: (self) => sceneBodyIsKinematic(self),
      isDynamic: (self) => sceneBodyIsDynamic(self),
      dispose: () => {
        world.off("begin-contact", onBegin);
        world.off("end-contact", onEnd);
        world.off("remove-body", onRemoveBody);
        let b = world.getBodyList();
        while (b) {
          const next = b.getNext();
          world.destroyBody(b);
          b = next;
        }
        collisionHandlers.clear();
        triggerHandlers.clear();
      },
    };

    let disposed = false;
    let physicsGameUpdateRegistered = false;
    update(() => {
      if (disposed) return;
      syncBodiesWithScene();
    });

    // Defer registration to `alwaysStartRegistry` so this runs after `main()` has
    // registered its own `gameUpdate` handlers (e.g. input → collisionBody.velocity before step).
    // `alwaysStartRegistry` also runs on mode changes; only register the physics step once.
    start(() => {
      if (physicsGameUpdateRegistered) return;
      physicsGameUpdateRegistered = true;
      gameUpdate((dt) => {
        if (disposed) return;
        const clamped = Math.min(dt, 0.1);
        syncKinematicAndStaticFromScene();
        syncDynamicVelocityFromScene();
        world.step(clamped, 8, 3);
        syncDynamicBodiesToScene();
      });
    });

    return { ...context, planck: api };
  };
}
