import { lookupBoundingBox } from "../bounding-box.ts";
import type { Collider } from "../physics.ts";
import { applyTransform, transform } from "./transform.ts";
import type { ViewportWithTransforms } from "./viewportTransforms.ts";

export function drawPhysicsCollider(viewport: ViewportWithTransforms, object: Collider) {
  const worldMatrix = transform(object)?.matrix;
  if (!worldMatrix) return;

  const bounds = lookupBoundingBox(object);
  const width = bounds?.width ?? 64;
  const height = bounds?.height ?? 64;
  const context = viewport.state.context;

  context.save();
  applyTransform(context, worldMatrix);
  const scale = Math.hypot(context.getTransform().a, context.getTransform().b) || 1;
  context.lineWidth = 1.5 / scale;
  context.strokeStyle = object.collider.sensor ? "#fbbf24" : "#4ade80";
  if (object.collider.sensor) context.setLineDash([4 / scale, 4 / scale]);
  context.strokeRect(-width / 2, -height / 2, width, height);
  context.restore();
}
