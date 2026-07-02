import { defineTrait, type GameObject } from "gameide";
import { z } from "zod";

const DEFAULT_POSITION_ICON = "move-3d";
const DEFAULT_ROTATION_ICON = "rotate-3d";
const DEFAULT_SCALE_ICON = "scaling";

export const transformVectorSchema = z.object({
  __icon: z.string().optional(),
  x: z.number().default(0),
  y: z.number().default(0),
  z: z.number().default(0),
});

export const transformPoseSchema = z.object({
  position: transformVectorSchema.default({
    __icon: DEFAULT_POSITION_ICON,
    x: 0,
    y: 0,
    z: 0,
  }),
  rotation: transformVectorSchema.default({
    __icon: DEFAULT_ROTATION_ICON,
    x: 0,
    y: 0,
    z: 0,
  }),
  scale: transformVectorSchema.default({
    __icon: DEFAULT_SCALE_ICON,
    x: 1,
    y: 1,
    z: 1,
  }),
});

export const transformSchema = z.object({
  transform: z
    .object({
      local: transformPoseSchema.default({
        position: { __icon: DEFAULT_POSITION_ICON, x: 0, y: 0, z: 0 },
        rotation: { __icon: DEFAULT_ROTATION_ICON, x: 0, y: 0, z: 0 },
        scale: { __icon: DEFAULT_SCALE_ICON, x: 1, y: 1, z: 1 },
      }),
      world: transformPoseSchema.default({
        position: { __icon: DEFAULT_POSITION_ICON, x: 0, y: 0, z: 0 },
        rotation: { __icon: DEFAULT_ROTATION_ICON, x: 0, y: 0, z: 0 },
        scale: { __icon: DEFAULT_SCALE_ICON, x: 1, y: 1, z: 1 },
      }),
    })
    .default({
      local: {
        position: { __icon: DEFAULT_POSITION_ICON, x: 0, y: 0, z: 0 },
        rotation: { __icon: DEFAULT_ROTATION_ICON, x: 0, y: 0, z: 0 },
        scale: { __icon: DEFAULT_SCALE_ICON, x: 1, y: 1, z: 1 },
      },
      world: {
        position: { __icon: DEFAULT_POSITION_ICON, x: 0, y: 0, z: 0 },
        rotation: { __icon: DEFAULT_ROTATION_ICON, x: 0, y: 0, z: 0 },
        scale: { __icon: DEFAULT_SCALE_ICON, x: 1, y: 1, z: 1 },
      },
    }),
});

export const transformTrait = defineTrait("Transform", transformSchema);

export type TransformVector = z.infer<typeof transformVectorSchema>;
export type TransformPose = z.infer<typeof transformPoseSchema>;
export type TransformSpace = "local" | "world";
export type TransformObject = GameObject & Partial<z.infer<typeof transformSchema>>;

function finiteNumberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function createDefaultVector(
  icon: string,
  defaults: { x: number; y: number; z: number },
): TransformVector {
  return { __icon: icon, ...defaults };
}

export function createDefaultTransformPose(): TransformPose {
  return {
    position: createDefaultVector(DEFAULT_POSITION_ICON, { x: 0, y: 0, z: 0 }),
    rotation: createDefaultVector(DEFAULT_ROTATION_ICON, { x: 0, y: 0, z: 0 }),
    scale: createDefaultVector(DEFAULT_SCALE_ICON, { x: 1, y: 1, z: 1 }),
  };
}

function normalizeVector(
  value: unknown,
  fallback: TransformVector,
): TransformVector {
  const vector = value as Partial<TransformVector> | undefined;
  return {
    __icon: typeof vector?.__icon === "string" ? vector.__icon : fallback.__icon,
    x: finiteNumberOr(vector?.x, fallback.x),
    y: finiteNumberOr(vector?.y, fallback.y),
    z: finiteNumberOr(vector?.z, fallback.z),
  };
}

function normalizePose(value: unknown): TransformPose {
  const pose = value as Partial<TransformPose> | undefined;
  const defaults = createDefaultTransformPose();
  return {
    position: normalizeVector(pose?.position, defaults.position),
    rotation: normalizeVector(pose?.rotation, defaults.rotation),
    scale: normalizeVector(pose?.scale, defaults.scale),
  };
}

function hasLegacyTransformFields(object: GameObject): boolean {
  return "position" in object || "rotation" in object || "scale" in object;
}

function readLegacyTransformPose(object: GameObject): TransformPose {
  return {
    position: normalizeVector(
      (object as { position?: unknown }).position,
      createDefaultTransformPose().position,
    ),
    rotation: normalizeVector(
      (object as { rotation?: unknown }).rotation,
      createDefaultTransformPose().rotation,
    ),
    scale: normalizeVector(
      (object as { scale?: unknown }).scale,
      createDefaultTransformPose().scale,
    ),
  };
}

export function hasTransformData(value: unknown): value is TransformObject {
  return !!value && typeof value === "object" && ("transform" in value || hasLegacyTransformFields(value as GameObject));
}

export function ensureTransform(object: GameObject): NonNullable<TransformObject["transform"]> {
  const typed = object as TransformObject;
  const existingTransform = typed.transform;
  if (!existingTransform || typeof existingTransform !== "object") {
    const local = createDefaultTransformPose();
    typed.transform = {
      local,
      world: normalizePose(local),
    };
    return typed.transform;
  }

  if (!existingTransform.local || typeof existingTransform.local !== "object") {
    existingTransform.local = createDefaultTransformPose();
  }
  if (!existingTransform.world || typeof existingTransform.world !== "object") {
    existingTransform.world = normalizePose(existingTransform.local);
  }

  return existingTransform;
}

export function ensureTransformSpace(
  object: GameObject,
  space: TransformSpace,
): TransformPose {
  const transform = ensureTransform(object);
  const pose = transform[space];
  if (!pose || typeof pose !== "object") {
    transform[space] = createDefaultTransformPose();
    return transform[space];
  }
  if (!pose.position || typeof pose.position !== "object") {
    pose.position = createDefaultTransformPose().position;
  }
  if (!pose.rotation || typeof pose.rotation !== "object") {
    pose.rotation = createDefaultTransformPose().rotation;
  }
  if (!pose.scale || typeof pose.scale !== "object") {
    pose.scale = createDefaultTransformPose().scale;
  }
  return pose as TransformPose;
}

function readExistingTransformPose(
  object: GameObject,
  space: TransformSpace,
): TransformPose | null {
  const typed = object as TransformObject;
  const transform = typed.transform;
  if (!transform || typeof transform !== "object") return null;

  const pose = transform[space];
  if (!pose || typeof pose !== "object") return null;
  return normalizePose(pose);
}

export function readTransformPose(
  object: GameObject,
  space: TransformSpace = "world",
): TransformPose {
  const existing = readExistingTransformPose(object, space);
  if (existing) return existing;
  if (hasLegacyTransformFields(object)) return readLegacyTransformPose(object);
  return createDefaultTransformPose();
}

function sameVector(left: TransformVector, right: TransformVector): boolean {
  return (
    left.__icon === right.__icon &&
    Object.is(left.x, right.x) &&
    Object.is(left.y, right.y) &&
    Object.is(left.z, right.z)
  );
}

export function writeTransformPose(
  object: GameObject,
  space: TransformSpace,
  pose: TransformPose,
): boolean {
  const target = ensureTransformSpace(object, space);
  const nextPosition = { ...target.position, ...pose.position };
  const nextRotation = { ...target.rotation, ...pose.rotation };
  const nextScale = { ...target.scale, ...pose.scale };
  if (
    sameVector(target.position, nextPosition) &&
    sameVector(target.rotation, nextRotation) &&
    sameVector(target.scale, nextScale)
  ) {
    return false;
  }

  ensureTransform(object)[space] = {
    position: nextPosition,
    rotation: nextRotation,
    scale: nextScale,
  };
  return true;
}

function rotate2D(x: number, y: number, radians: number): { x: number; y: number } {
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return {
    x: x * cosine - y * sine,
    y: x * sine + y * cosine,
  };
}

function safeDivide(value: number, divisor: number, fallback: number): number {
  return Math.abs(divisor) > 1e-6 ? value / divisor : fallback;
}

export function composeWorldTransform(
  parentWorld: TransformPose,
  local: TransformPose,
): TransformPose {
  const scaledLocalPosition = {
    x: local.position.x * parentWorld.scale.x,
    y: local.position.y * parentWorld.scale.y,
  };
  const rotatedLocalPosition = rotate2D(
    scaledLocalPosition.x,
    scaledLocalPosition.y,
    parentWorld.rotation.z,
  );

  return {
    position: {
      ...local.position,
      x: parentWorld.position.x + rotatedLocalPosition.x,
      y: parentWorld.position.y + rotatedLocalPosition.y,
      z: parentWorld.position.z + local.position.z,
    },
    rotation: {
      ...local.rotation,
      x: parentWorld.rotation.x + local.rotation.x,
      y: parentWorld.rotation.y + local.rotation.y,
      z: parentWorld.rotation.z + local.rotation.z,
    },
    scale: {
      ...local.scale,
      x: parentWorld.scale.x * local.scale.x,
      y: parentWorld.scale.y * local.scale.y,
      z: parentWorld.scale.z * local.scale.z,
    },
  };
}

export function deriveLocalTransform(
  parentWorld: TransformPose,
  world: TransformPose,
): TransformPose {
  const translated = {
    x: world.position.x - parentWorld.position.x,
    y: world.position.y - parentWorld.position.y,
  };
  const unrotated = rotate2D(translated.x, translated.y, -parentWorld.rotation.z);

  return {
    position: {
      ...world.position,
      x: safeDivide(unrotated.x, parentWorld.scale.x, 0),
      y: safeDivide(unrotated.y, parentWorld.scale.y, 0),
      z: world.position.z - parentWorld.position.z,
    },
    rotation: {
      ...world.rotation,
      x: world.rotation.x - parentWorld.rotation.x,
      y: world.rotation.y - parentWorld.rotation.y,
      z: world.rotation.z - parentWorld.rotation.z,
    },
    scale: {
      ...world.scale,
      x: safeDivide(world.scale.x, parentWorld.scale.x, 1),
      y: safeDivide(world.scale.y, parentWorld.scale.y, 1),
      z: safeDivide(world.scale.z, parentWorld.scale.z, 1),
    },
  };
}
