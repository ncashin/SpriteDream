export function applyTransform(context: CanvasRenderingContext2D, matrix: DOMMatrix) {
  context.setTransform(context.getTransform().multiply(matrix));
}
