export type Viewport = {
  x: number;
  y: number;
  scale: number;
};

let viewport: Viewport = {
  x: 0,
  y: 0,
  scale: 1,
};

export const getViewport = (): Viewport => ({ ...viewport });

export const setViewport = (x: number, y: number): void => {
  viewport.x = x;
  viewport.y = y;
};

export const setViewportScale = (scale: number): void => {
  viewport.scale = Math.max(0.1, Math.min(10, scale));
};

export const updateViewport = (deltaX: number, deltaY: number): void => {
  viewport.x += deltaX;
  viewport.y += deltaY;
};

export const zoomViewport = (
  deltaScale: number,
  screenX: number,
  screenY: number
): void => {
  const oldScale = viewport.scale;
  const newScale = Math.max(0.1, Math.min(10, oldScale + deltaScale));

  if (newScale === oldScale) return;

  const canvas = document.querySelector("canvas");
  if (!canvas) return;

  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;

  // Convert screen point to world coordinates
  const worldX = (screenX - centerX) / oldScale + viewport.x;
  const worldY = (screenY - centerY) / oldScale + viewport.y;

  // Keep the same world point under the mouse after zoom
  viewport.scale = newScale;
  viewport.x = worldX - (screenX - centerX) / newScale;
  viewport.y = worldY - (screenY - centerY) / newScale;
};

export const resetViewport = (): void => {
  // Center viewport at world origin (0, 0) - viewport position represents center
  viewport.scale = 1;
  viewport.x = 0;
  viewport.y = 0;
};
