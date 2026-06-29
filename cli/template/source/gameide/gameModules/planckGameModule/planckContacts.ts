import { WorldManifold, type Contact, type Fixture, type World } from "planck";
import type { GameObject } from "gameide";
import { getBodyData } from "./planckBodies.js";

export type PlanckContactPhase = "enter" | "exit";

export type PlanckContact = {
  other: GameObject;
  normal?: { x: number; y: number };
};

type PlanckContactRecord = PlanckContact & {
  refCount: number;
};

export type PlanckCollisionInfo = {
  phase: PlanckContactPhase;
  self: GameObject;
  normal?: { x: number; y: number };
  contacts: readonly PlanckContact[];
};

export type PlanckCollisionHandler = (
  other: GameObject,
  collisionInfo: PlanckCollisionInfo,
) => void;

export type PlanckContactMaps = {
  collisionHandlers: Map<GameObject, PlanckCollisionHandler>;
  triggerHandlers: Map<GameObject, Set<PlanckCollisionHandler>>;
};

type PlanckContactStore = Map<GameObject, Map<GameObject, PlanckContactRecord>>;

type PlanckContactStores = {
  collisionContacts: PlanckContactStore;
  triggerContacts: PlanckContactStore;
};

const EMPTY_CONTACTS: readonly PlanckContact[] = [];

function contactsForSelf(store: PlanckContactStore, self: GameObject): readonly PlanckContact[] {
  const others = store.get(self);
  if (!others || others.size === 0) return EMPTY_CONTACTS;
  return [...others.values()];
}

function addContact(
  store: PlanckContactStore,
  self: GameObject,
  other: GameObject,
  normal?: { x: number; y: number },
) {
  let others = store.get(self);
  if (!others) {
    others = new Map();
    store.set(self, others);
  }
  const existing = others.get(other);
  if (existing) {
    existing.refCount += 1;
    if (normal) existing.normal = normal;
    return;
  }
  others.set(other, { other, normal, refCount: 1 });
}

function removeContact(store: PlanckContactStore, self: GameObject, other: GameObject) {
  const others = store.get(self);
  if (!others) return;
  const existing = others.get(other);
  if (!existing) return;
  existing.refCount -= 1;
  if (existing.refCount <= 0) others.delete(other);
  if (others.size === 0) store.delete(self);
}

export function clearPlanckContactsForObject(stores: PlanckContactStores, object: GameObject) {
  stores.collisionContacts.delete(object);
  stores.triggerContacts.delete(object);
  for (const others of stores.collisionContacts.values()) others.delete(object);
  for (const others of stores.triggerContacts.values()) others.delete(object);
}

export function subscribePlanckWorldContacts(
  world: World,
  maps: PlanckContactMaps,
): { unsubscribe: () => void; clearContactsForObject: (object: GameObject) => void } {
  const collisionWorldManifold = new WorldManifold();
  const stores: PlanckContactStores = {
    collisionContacts: new Map(),
    triggerContacts: new Map(),
  };

  const contactNormal = (
    contact: Contact,
    selfFixture: Fixture,
  ): { x: number; y: number } | undefined => {
    const worldManifold = contact.getWorldManifold(collisionWorldManifold);
    const manifoldNormal = worldManifold?.normal;
    if (!manifoldNormal) return undefined;
    const selfIsFixtureA = selfFixture === contact.getFixtureA();
    return {
      x: selfIsFixtureA ? -manifoldNormal.x : manifoldNormal.x,
      y: selfIsFixtureA ? -manifoldNormal.y : manifoldNormal.y,
    };
  };

  const buildCollisionInfo = (
    self: GameObject,
    phase: PlanckContactPhase,
    contact: Contact,
    selfFixture: Fixture,
    contactStore: PlanckContactStore,
  ): PlanckCollisionInfo => ({
    phase,
    self,
    normal: phase === "exit" ? undefined : contactNormal(contact, selfFixture),
    contacts: contactsForSelf(contactStore, self),
  });

  const notifyCollisionHandler = (
    self: GameObject,
    other: GameObject,
    phase: PlanckContactPhase,
    contact: Contact,
    selfFixture: Fixture,
    contactStore: PlanckContactStore,
  ) => {
    const handlerFn = maps.collisionHandlers.get(self);
    if (!handlerFn) return;
    const collisionInfo = buildCollisionInfo(self, phase, contact, selfFixture, contactStore);
    try {
      handlerFn(other, collisionInfo);
    } catch (err) {
      console.error("planckGameModule handler error", err);
    }
  };

  const notifyTriggerHandlers = (
    self: GameObject,
    other: GameObject,
    phase: PlanckContactPhase,
    contact: Contact,
    selfFixture: Fixture,
    contactStore: PlanckContactStore,
  ) => {
    const handlerSet = maps.triggerHandlers.get(self);
    if (!handlerSet) return;
    const collisionInfo = buildCollisionInfo(self, phase, contact, selfFixture, contactStore);
    for (const handlerFn of handlerSet) {
      try {
        handlerFn(other, collisionInfo);
      } catch (err) {
        console.error("planckGameModule handler error", err);
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
    const contactStore = isTrigger ? stores.triggerContacts : stores.collisionContacts;

    if (phase === "enter") {
      const normalA = contactNormal(contact, fixtureA);
      const normalB = contactNormal(contact, fixtureB);
      addContact(contactStore, bodyDataA, bodyDataB, normalA);
      addContact(contactStore, bodyDataB, bodyDataA, normalB);
    } else {
      removeContact(contactStore, bodyDataA, bodyDataB);
      removeContact(contactStore, bodyDataB, bodyDataA);
    }

    if (isTrigger) {
      notifyTriggerHandlers(bodyDataA, bodyDataB, phase, contact, fixtureA, contactStore);
      notifyTriggerHandlers(bodyDataB, bodyDataA, phase, contact, fixtureB, contactStore);
    } else {
      notifyCollisionHandler(bodyDataA, bodyDataB, phase, contact, fixtureA, contactStore);
      notifyCollisionHandler(bodyDataB, bodyDataA, phase, contact, fixtureB, contactStore);
    }
  };

  const onBegin = (contact: Contact) => runContact(contact, "enter");
  const onEnd = (contact: Contact) => runContact(contact, "exit");
  world.on("begin-contact", onBegin);
  world.on("end-contact", onEnd);

  return {
    unsubscribe: () => {
      world.off("begin-contact", onBegin);
      world.off("end-contact", onEnd);
      stores.collisionContacts.clear();
      stores.triggerContacts.clear();
    },
    clearContactsForObject: (object) => clearPlanckContactsForObject(stores, object),
  };
}
