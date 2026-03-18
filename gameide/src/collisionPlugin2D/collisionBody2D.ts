import { defineObject } from "../objectRegistry.js";

export const collisionBody2D = defineObject(
  {
    collisionBody2D: {
      // Static bodies are not moved by physics.
      isStatic: false,
      // Matter.js physics properties.
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

