/** Deep-merge `patch` into `target` (mutates `target`). */
export function merge(
  target: Record<PropertyKey, unknown>,
  patch: Record<PropertyKey, unknown>,
): void {
  for (const propertyKey of Object.keys(patch)) {
    const patchValue = patch[propertyKey];
    // `null` matches `undefined`: patches survive JSON (undefined keys are dropped).
    if (patchValue === undefined || patchValue === null) {
      Reflect.deleteProperty(target, propertyKey);
      continue;
    }
    const patchIsObject = patchValue && typeof patchValue === "object";

    const targetValue = target[propertyKey];
    const targetIsObject = targetValue && typeof targetValue === "object";

    if (patchIsObject && targetIsObject) {
      merge(
        targetValue as Record<PropertyKey, unknown>,
        patchValue as Record<PropertyKey, unknown>,
      );
      continue;
    }

    if (patchValue && typeof patchValue === "object") {
      target[propertyKey] = structuredClone(patchValue);
      continue;
    }

    target[propertyKey] = patchValue;
  }
}
