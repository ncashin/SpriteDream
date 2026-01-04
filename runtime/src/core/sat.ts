import type { Vector } from "./vector";
import {
  create,
  add,
  sub,
  scale,
  dot,
  length,
  normalize,
} from "./vector";

export type CollisionObject = {
  colliderName: string;
  resolverName: string;
  collisionEnabled?: boolean;
} ;

export type ColliderDefinition<T extends CollisionObject = CollisionObject> = {
  name: string;
  getNormals: (collisionObject: T, other: CollisionObject) => Vector[];
  getClosestPoint: (collisionObject: T, point: Vector) => Vector;
  calculateProjection: (
    collisionObject: T,
    normal: Vector
  ) => { min: number; max: number };
  debugDraw?: (collisionObject: T, context: CanvasRenderingContext2D) => void;
};

export type ResolverDefinition<T extends CollisionObject = CollisionObject> = {
  name: string;
  resolveCollision: (
    objA: T,
    objB: CollisionObject,
    overlapAmount: number,
    overlapNormal: Vector
  ) => void;
};

export const resolvers: { [name: string]: ResolverDefinition<any> } = {};
export const registerResolver = (resolver: ResolverDefinition<any>) => {
  resolvers[resolver.name] = resolver;
};
export const unregisterResolver = (name: string) => {
  delete resolvers[name];
};

export const colliders: { [name: string]: ColliderDefinition<any> } = {};
export const registerCollider = (collider: ColliderDefinition<any>) => {
  colliders[collider.name] = collider;
};
export const unregisterCollider = (name: string) => {
  delete colliders[name];
};

export const handleCollisionPair = (objA: CollisionObject, objB: CollisionObject) => {
  if (!objA.collisionEnabled || !objB.collisionEnabled) return;
  
  const colliderA = colliders[objA.colliderName];
  const resolverA = resolvers[objA.resolverName];
  
  if (!colliderA || !resolverA) {
    console.warn(`Missing collider or resolver for object A: ${objA.colliderName}, ${objA.resolverName}`);
    return;
  }
  
  const colliderB = colliders[objB.colliderName];
  const resolverB = resolvers[objB.resolverName];
  
  if (!colliderB || !resolverB) {
    console.warn(`Missing collider or resolver for object B: ${objB.colliderName}, ${objB.resolverName}`);
    return;
  }

  const normals = [...colliderA.getNormals(objA, objB), ...colliderB.getNormals(objB, objA)];

  let minOverlap = Infinity;
  let smallestNormal: Vector | null = null;
  let direction: number = 1;

  for (const normal of normals) {
    const n = normalize(normal);
    const projA = colliderA.calculateProjection(objA, n);
    const projB = colliderB.calculateProjection(objB, n);

    const overlapA = projB.max - projA.min;
    const overlapB = projA.max - projB.min;

    if (overlapA <= 0 || overlapB <= 0) {
      minOverlap = 0;
      smallestNormal = null;
      break;
    }

    let currentOverlap: number;
    let currentDirection: number;

    if (overlapA < overlapB) {
      currentOverlap = overlapA;
      currentDirection = 1;
    } else {
      currentOverlap = overlapB;
      currentDirection = -1;
    }

    if (currentOverlap < minOverlap) {
      minOverlap = currentOverlap;
      smallestNormal = n;
      direction = currentDirection;
    }
  }

  if (smallestNormal && minOverlap > 0 && minOverlap < Infinity) {
    resolverA.resolveCollision(objA, objB, minOverlap * direction, smallestNormal);
    resolverB.resolveCollision(objB, objA, minOverlap * -direction, smallestNormal);
  }
};

export const updateCollisionObjects = (collisionObjects: CollisionObject[]) => {
  for (let i = 0; i < collisionObjects.length; i++) {
    const objA = collisionObjects[i];
    
    for (let j = i + 1; j < collisionObjects.length; j++) {
      const objB = collisionObjects[j];
      handleCollisionPair(objA, objB);
    }
  }
};

export const debugDrawColliders = (collisionObjects: CollisionObject[], context: CanvasRenderingContext2D) => {
  collisionObjects.forEach(obj => {
    const collider = colliders[obj.colliderName];
    if (!collider || !collider.debugDraw) return;
    collider.debugDraw(obj, context);
  });
};

export type RectangleCollisionObject = CollisionObject & {
  position: Vector;
  width: number;
  height: number;
  color?: string;
  isColliding?: boolean;
  velocity: Vector;
  angle: number;
  angularVelocity?: number;
};

export type CircleCollisionObject = CollisionObject & {
  position: Vector;
  velocity: Vector;
  radius: number;
  color?: string;
  isColliding?: boolean;
};

export const RECTANGLE_COLLIDER: ColliderDefinition<RectangleCollisionObject> = {
  name: "rectangle",
  getNormals: (collisionObject, _other) => {
    const angle = ((collisionObject.angle || 0) * Math.PI) / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    const rotateVector = (v: Vector) =>
      create(v[0] * cos - v[1] * sin, v[0] * sin + v[1] * cos);

    return [
      rotateVector(create(0, 1)),
      rotateVector(create(1, 0)),
    ];
  },

  getClosestPoint: (collisionObject, point) => {
    const center = collisionObject.position;
    const width = collisionObject.width;
    const height = collisionObject.height;
    const angle = ((collisionObject.angle || 0) * Math.PI) / 180;

    const rectCenter = add(center, create(width / 2, height / 2));

    const localPoint = sub(point, rectCenter);
    const cos = Math.cos(-angle);
    const sin = Math.sin(-angle);
    
    const rotatedPoint = create(
      localPoint[0] * cos - localPoint[1] * sin,
      localPoint[0] * sin + localPoint[1] * cos
    );

    const hw = width / 2;
    const hh = height / 2;
    const clampedX = Math.max(-hw, Math.min(hw, rotatedPoint[0]));
    const clampedY = Math.max(-hh, Math.min(hh, rotatedPoint[1]));

    const localClamped = create(clampedX, clampedY);
    const cos2 = Math.cos(angle);
    const sin2 = Math.sin(angle);
    
    const worldClamped = create(
      localClamped[0] * cos2 - localClamped[1] * sin2,
      localClamped[0] * sin2 + localClamped[1] * cos2
    );

    return add(rectCenter, worldClamped);
  },

  calculateProjection: (collisionObject, normal) => {
    const width = collisionObject.width;
    const height = collisionObject.height;
    const angle = ((collisionObject.angle || 0) * Math.PI) / 180;
    const center = collisionObject.position;
    const rectCenter = add(center, create(width / 2, height / 2));

    const hw = width / 2;
    const hh = height / 2;

    const localCorners = [
      create(-hw, -hh),
      create(hw, -hh),
      create(hw, hh),
      create(-hw, hh),
    ];

    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    
    const corners = localCorners.map(localCorner => {
      const worldCorner = create(
        localCorner[0] * cos - localCorner[1] * sin,
        localCorner[0] * sin + localCorner[1] * cos
      );
      return add(rectCenter, worldCorner);
    });

    const projections = corners.map((corner) => dot(corner, normal));
    return {
      min: Math.min(...projections),
      max: Math.max(...projections),
    };
  },

  debugDraw: (collisionObject, context) => {
    const center = collisionObject.position;
    const width = collisionObject.width;
    const height = collisionObject.height;
    const angle = ((collisionObject.angle || 0) * Math.PI) / 180;
    
    const rectCenter = add(center, create(width / 2, height / 2));

    context.save();
    context.strokeStyle = "#ff0000";
    context.lineWidth = 2;
    
    context.translate(rectCenter[0], rectCenter[1]);
    context.rotate(angle);
    
    context.strokeRect(-width / 2, -height / 2, width, height);
    context.restore();

    context.save();
    context.fillStyle = "#ff0000";
    context.beginPath();
    context.arc(rectCenter[0], rectCenter[1], 3, 0, Math.PI * 2);
    context.fill();
    context.restore();
  },
};
export const STATIC_RESOLVER: ResolverDefinition<RectangleCollisionObject> = {
  name: "static",
  resolveCollision: (_objA, _objB, _overlapAmount, _overlapNormal) => {},
};

export const CIRCLE_COLLIDER: ColliderDefinition<CircleCollisionObject> = {
  name: "circle",
  getNormals: (collisionObject, other) => {
    const otherCollider = colliders[other.colliderName];
    const closestPoint = otherCollider.getClosestPoint(other, collisionObject.position);
    const direction = sub(closestPoint, collisionObject.position);
    if (length(direction) > 0) {
      return [normalize(direction)];
    }
    return [];
  },

  getClosestPoint: (collisionObject, point) => {
    const direction = sub(point, collisionObject.position);
    if (length(direction) <= collisionObject.radius) {
      return point;
    }
    return add(
      collisionObject.position,
      scale(normalize(direction), collisionObject.radius)
    );
  },

  calculateProjection: (collisionObject, normal) => {
    const projection = dot(collisionObject.position, normal);
    return {
      min: projection - collisionObject.radius,
      max: projection + collisionObject.radius,
    };
  },

  debugDraw: (collisionObject, context) => {
    context.save();
    context.strokeStyle = "#ff0000";
    context.lineWidth = 2;
    
    context.beginPath();
    context.arc(collisionObject.position[0], collisionObject.position[1], collisionObject.radius, 0, Math.PI * 2);
    context.stroke();
    context.restore();

    context.save();
    context.fillStyle = "#ff0000";
    context.beginPath();
    context.arc(collisionObject.position[0], collisionObject.position[1], 3, 0, Math.PI * 2);
    context.fill();
    context.restore();

    if (collisionObject.velocity) {
      context.save();
      context.strokeStyle = "#00ff00";
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(collisionObject.position[0], collisionObject.position[1]);
      const scaleFactor = 0.1;
      context.lineTo(
        collisionObject.position[0] + collisionObject.velocity[0] * scaleFactor,
        collisionObject.position[1] + collisionObject.velocity[1] * scaleFactor
      );
      context.stroke();
      context.restore();
    }
  },
};

export const BOUNCY_RESOLVER: ResolverDefinition<CircleCollisionObject> = {
  name: "bouncy",
  resolveCollision: (objA, _objB, overlapAmount, overlapNormal) => {
    objA.position = add(
      objA.position,
      scale(normalize(overlapNormal), overlapAmount)
    );

    const n = normalize(overlapNormal);
    const vDotN = dot(objA.velocity, n);
    const COLLISION_DAMPING = 0.7;

    objA.velocity = sub(
      objA.velocity,
      scale(n, (1 + COLLISION_DAMPING) * vDotN)
    );

    const tangent = create(-n[1], n[0]);
    const vDotT = dot(objA.velocity, tangent);
    const FRICTION = 0.2;
    objA.velocity = sub(objA.velocity, scale(tangent, vDotT * FRICTION));

    const VELOCITY_EPSILON_X = 10;
    const VELOCITY_EPSILON_Y = 40;
    let vx = objA.velocity[0];
    let vy = objA.velocity[1];
    if (Math.abs(vx) < VELOCITY_EPSILON_X) vx = 0;
    if (Math.abs(vy) < VELOCITY_EPSILON_Y) vy = 0;
    objA.velocity = create(vx, vy);
  },
};

export const PLATFORMER_RESOLVER: ResolverDefinition<RectangleCollisionObject> = {
  name: "platformer",
  resolveCollision: (objA, _objB, overlapAmount, overlapNormal) => {
    const n = normalize(overlapNormal);
    objA.position = add(
      objA.position,
      scale(n, overlapAmount)
    );

    if (!objA.velocity) {
      objA.velocity = create(0, 0);
    }

    const vDotN = dot(objA.velocity, n);

    if (vDotN < 0) {
      objA.velocity = sub(objA.velocity, scale(n, vDotN));
    }

    if (n[1] < -0.5) {
      objA.velocity = create(objA.velocity[0], 0);
    }

    if (Math.abs(n[1]) < 0.7) {
      const friction = 0.8;
      objA.velocity = scale(objA.velocity, friction);
    }

    const VELOCITY_EPSILON = 1;
    let vx = objA.velocity[0];
    let vy = objA.velocity[1];
    if (Math.abs(vx) < VELOCITY_EPSILON) vx = 0;
    if (Math.abs(vy) < VELOCITY_EPSILON) vy = 0;
    objA.velocity = create(vx, vy);
  },
};

registerCollider(RECTANGLE_COLLIDER);
registerResolver(STATIC_RESOLVER);

registerCollider(CIRCLE_COLLIDER);
registerResolver(BOUNCY_RESOLVER);

registerResolver(PLATFORMER_RESOLVER);
