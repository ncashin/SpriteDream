import { defineObject } from "./objectRegistry.js";
import { TransformDefinition } from "./transform.js";

export const ShapeDefinition = defineObject({
  ...TransformDefinition.schema,
  size: 0,
});
