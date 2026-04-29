import { WorldManifold, type Contact, type Fixture } from "planck";

const worldManifold = new WorldManifold();

/**
 * True when `selfFixture` is supported from below (world +Y), e.g. standing on a floor or
 * platform — not when sliding on a vertical wall. Uses the contact manifold normal, which
 * points from fixture A toward fixture B in world space.
 */
export function contactSupportsSelfFromBelow(
  contact: Contact,
  selfFixture: Fixture,
  minUpDot = 0.5,
): boolean {
  const wm = contact.getWorldManifold(worldManifold);
  if (!wm) return false;
  const ny = wm.normal.y;
  const selfIsA = selfFixture === contact.getFixtureA();
  const upY = selfIsA ? -ny : ny;
  return upY >= minUpDot;
}
