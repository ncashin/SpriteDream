import type { Body, BodyType } from "planck";

/**
 * Unity Rigidbody2D–style view of a Planck body. Prefer `planck.getRigidbody(obj)` over importing Planck in game code.
 */
export type Rigidbody2D = {
  /** Underlying Planck body (joints, fixtures, advanced APIs). */
  readonly raw: Body;
  readonly bodyType: BodyType;
  readonly isStatic: boolean;
  readonly isKinematic: boolean;
  readonly isDynamic: boolean;
  getLinearVelocity(): { x: number; y: number };
  getAngularVelocity(): number;
  setAngularVelocity(radiansPerSecond: number): void;
  getPosition(): { x: number; y: number };
  getAngle(): number;
};

export function wrapRigidbody2D(body: Body): Rigidbody2D {
  return {
    get raw() {
      return body;
    },
    get bodyType() {
      return body.getType();
    },
    get isStatic() {
      return body.getType() === "static";
    },
    get isKinematic() {
      return body.getType() === "kinematic";
    },
    get isDynamic() {
      return body.getType() === "dynamic";
    },
    getLinearVelocity() {
      const v = body.getLinearVelocity();
      return { x: v.x, y: v.y };
    },
    getAngularVelocity() {
      return body.getAngularVelocity();
    },
    setAngularVelocity(radiansPerSecond) {
      body.setAngularVelocity(radiansPerSecond);
    },
    getPosition() {
      const p = body.getPosition();
      return { x: p.x, y: p.y };
    },
    getAngle() {
      return body.getAngle();
    },
  };
}
