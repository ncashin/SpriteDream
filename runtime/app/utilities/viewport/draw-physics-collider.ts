import type { Collider } from "../physics.ts";
import { applyTransform, transform } from "./transform.ts";
import type { ViewportWithTransforms } from "./viewportTransforms.ts";

export function drawPhysicsCollider(viewport: ViewportWithTransforms, object: Collider) {
  const worldMatrix = transform(object)?.matrix;
  if (!worldMatrix) return;

  const width = object.collider.width;
  const height = object.collider.height;
  const context = viewport.state.context;

  const frame = withoutScale(worldMatrix);
  context.save();
  applyTransform(context, frame.matrix);
  const scale = Math.hypot(context.getTransform().a, context.getTransform().b) || 1;
  context.lineWidth = 1.5 / scale;
  context.strokeStyle = object.collider.sensor ? "#fbbf24" : "#4ade80";
  if (object.collider.sensor) context.setLineDash([4 / scale, 4 / scale]);
  const scaledWidth = width * frame.scaleX;
  const scaledHeight = height * frame.scaleY;
  context.strokeRect(-scaledWidth / 2, -scaledHeight / 2, scaledWidth, scaledHeight);
  context.restore();
}

function withoutScale(matrix: DOMMatrix) {
  const scaleX = Math.hypot(matrix.a, matrix.b) || 1;
  const scaleY = Math.hypot(matrix.c, matrix.d) || 1;
  const placed = new DOMMatrix();
  placed.a = matrix.a / scaleX;
  placed.b = matrix.b / scaleX;
  placed.c = matrix.c / scaleY;
  placed.d = matrix.d / scaleY;
  placed.e = matrix.e;
  placed.f = matrix.f;
  return { matrix: placed, scaleX, scaleY };
}
