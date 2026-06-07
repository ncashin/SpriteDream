import { WorldManifold, type Contact, type Fixture, type World } from "planck";
import type { GameObject } from "gameide";
import { getBodyData } from "./planckBodies.js";

export type PlanckContactPhase = "enter" | "exit";

export type PlanckCollisionInfo = {
  phase: PlanckContactPhase;
  self: GameObject;
  normal?: { x: number; y: number };
};

export type PlanckCollisionHandler = (
  other: GameObject,
  collisionInfo: PlanckCollisionInfo,
) => void;

export type PlanckContactMaps = {
  collisionHandlers: Map<GameObject, PlanckCollisionHandler>;
  triggerHandlers: Map<GameObject, Set<PlanckCollisionHandler>>;
};

export function subscribePlanckWorldContacts(world: World, maps: PlanckContactMaps): () => void {
  const collisionWorldManifold = new WorldManifold();

  const buildCollisionInfo = (
    self: GameObject,
    phase: PlanckContactPhase,
    contact: Contact,
    selfFixture: Fixture,
  ): PlanckCollisionInfo => {
    if (phase === "exit") return { phase, self };
    const worldManifold = contact.getWorldManifold(collisionWorldManifold);
    const manifoldNormal = worldManifold?.normal;
    const selfIsFixtureA = selfFixture === contact.getFixtureA();
    return {
      phase,
      self,
      normal: manifoldNormal
        ? {
            x: selfIsFixtureA ? -manifoldNormal.x : manifoldNormal.x,
            y: selfIsFixtureA ? -manifoldNormal.y : manifoldNormal.y,
          }
        : undefined,
    };
  };

  const notifyCollisionHandler = (
    self: GameObject,
    other: GameObject,
    phase: PlanckContactPhase,
    contact: Contact,
    selfFixture: Fixture,
  ) => {
    const handlerFn = maps.collisionHandlers.get(self);
    if (!handlerFn) return;
    const collisionInfo = buildCollisionInfo(self, phase, contact, selfFixture);
    try {
      handlerFn(other, collisionInfo);
    } catch (err) {
      console.error("planckPlugin handler error", err);
    }
  };

  const notifyTriggerHandlers = (
    self: GameObject,
    other: GameObject,
    phase: PlanckContactPhase,
    contact: Contact,
    selfFixture: Fixture,
  ) => {
    const handlerSet = maps.triggerHandlers.get(self);
    if (!handlerSet) return;
    const collisionInfo = buildCollisionInfo(self, phase, contact, selfFixture);
    for (const handlerFn of handlerSet) {
      try {
        handlerFn(other, collisionInfo);
      } catch (err) {
        console.error("planckPlugin handler error", err);
      }
    }
  };

  const runContact = (contact: Contact, phase: PlanckContactPhase) => {
    const bodyA = contact.getFixtureA().getBody();
    const bodyB = contact.getFixtureB().getBody();
    const bodyDataA = getBodyData(bodyA);
    const bodyDataB = getBodyData(bodyB);
    if (!bodyDataA || !bodyDataB || bodyDataA === bodyDataB) return;
    const fixtureA = contact.getFixtureA();
    const fixtureB = contact.getFixtureB();
    const isTrigger = fixtureA.isSensor() || fixtureB.isSensor();
    if (isTrigger) {
      notifyTriggerHandlers(bodyDataA, bodyDataB, phase, contact, fixtureA);
      notifyTriggerHandlers(bodyDataB, bodyDataA, phase, contact, fixtureB);
    } else {
      notifyCollisionHandler(bodyDataA, bodyDataB, phase, contact, fixtureA);
      notifyCollisionHandler(bodyDataB, bodyDataA, phase, contact, fixtureB);
    }
  };

  const onBegin = (contact: Contact) => runContact(contact, "enter");
  const onEnd = (contact: Contact) => runContact(contact, "exit");
  world.on("begin-contact", onBegin);
  world.on("end-contact", onEnd);

  return () => {
    world.off("begin-contact", onBegin);
    world.off("end-contact", onEnd);
  };
}
