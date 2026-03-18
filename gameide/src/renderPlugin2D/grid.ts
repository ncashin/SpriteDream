import { Application, Graphics } from "pixi.js";
import { update } from "../gameloop.js";
import { GameIDEMode, getMode } from "../mode.js";
import type { Viewport } from "./viewport.js";

export function initializeGridRendering(app: Application, viewport: Viewport): void {
  const grid = new Graphics();
  const origin = new Graphics();
  grid.eventMode = "none";
  origin.eventMode = "none";
  app.stage.addChild(grid, origin);

  let lastMode: GameIDEMode | undefined;
  let lastWidth = -1;
  let lastHeight = -1;

  function redrawGrid(): void {
    const mode = getMode();
    if (mode !== GameIDEMode.Editor) {
      if (grid.visible || origin.visible) {
        grid.clear();
        origin.clear();
        grid.visible = false;
        origin.visible = false;
      }
      lastMode = mode;
      return;
    }

    const width = app.screen.width;
    const height = app.screen.height;
    if (lastMode === mode && lastWidth === width && lastHeight === height) return;

    lastMode = mode;
    lastWidth = width;
    lastHeight = height;

    grid.visible = true;
    origin.visible = true;
    grid.clear();
    origin.clear();

    const spacing = 32;
    const left = -viewport.width / 2;
    const right = viewport.width / 2;
    const top = -viewport.height / 2;
    const bottom = viewport.height / 2;

    for (let x = Math.floor(left / spacing) * spacing; x <= right; x += spacing) {
      grid.moveTo(x, top);
      grid.lineTo(x, bottom);
    }

    for (let y = Math.floor(top / spacing) * spacing; y <= bottom; y += spacing) {
      grid.moveTo(left, y);
      grid.lineTo(right, y);
    }

    grid.stroke({ width: 1, color: 0x4b5563, alpha: 0.18 });

    origin.moveTo(0, -8);
    origin.lineTo(0, 8);
    origin.moveTo(-8, 0);
    origin.lineTo(8, 0);
    origin.stroke({ width: 2, color: 0xf97316, alpha: 0.95 });
  }

  update(redrawGrid);
}
