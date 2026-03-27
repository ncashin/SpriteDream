import { defineObject } from "../objectRegistry.js";

export const collisionBody2D = defineObject(
  {
    collisionBody2D: {
      isStatic: false,
      mass: 1,
      friction: 0,
      frictionAir: 0,
      restitution: 0,
    },
  },
  {
    displayName: "Collision Body 2D",
    description: "Matter.js body properties used by collisionPlugin2D",
  },
);
