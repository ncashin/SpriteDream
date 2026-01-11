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
  centerX: number,
  centerY: number
): void => {
  const oldScale = viewport.scale;
  const newScale = Math.max(0.1, Math.min(10, oldScale + deltaScale));
  
  if (newScale === oldScale) return;
  
  const worldX = centerX / oldScale + viewport.x;
  const worldY = centerY / oldScale + viewport.y;
  
  viewport.scale = newScale;
  viewport.x = worldX - centerX / newScale;
  viewport.y = worldY - centerY / newScale;
};

export const resetViewport = (): void => {
  viewport.x = 0;
  viewport.y = 0;
  viewport.scale = 1;
};

