import { Container, FederatedPointerEvent, Graphics, Rectangle } from "pixi.js";

import { hasComponent } from "../components";
import type { GameContext } from "../initialization";
import { TransformComponent } from "../transform";
import { SpriteComponent } from "./sprite";
import type { Viewport } from "./viewport";

export const handleSelectedObjects = (
  gameContext: GameContext,
  viewport: Viewport,
  stage: Container,
) => {
  const { onUpdate, selectedObjectsStore } = gameContext;

  const gizmoLayer = new Container();

  gizmoLayer.zIndex = 9999;
  gizmoLayer.sortableChildren = true;

  const xGizmo = new Graphics();
  const yGizmo = new Graphics();
  const areaGizmo = new Graphics();

  const width = 5;
  const areaSize = 30;

  // Draw X gizmo
  xGizmo
    .moveTo(width / 2, -width / 2)
    .lineTo(-100, -width / 2)
    .lineTo(-100, width / 2)
    .lineTo(0, width / 2)
    .closePath()
    .fill(0xff3333);

  xGizmo.moveTo(-100, -10).lineTo(-120, 0).lineTo(-100, 10).closePath().fill(0xff3333);

  // Draw Y gizmo
  yGizmo
    .moveTo(-width / 2, width / 2)
    .lineTo(-width / 2, 100)
    .lineTo(width / 2, 100)
    .lineTo(width / 2, -width / 2)
    .closePath()
    .fill(0x33ff66);

  yGizmo.moveTo(-10, 100).lineTo(0, 120).lineTo(10, 100).closePath().fill(0x33ff66);

  // Draw area gizmo
  areaGizmo
    .moveTo(-width / 2, width / 2)
    .lineTo(-width / 2 - areaSize, width / 2)
    .lineTo(-width / 2 - areaSize, width / 2 + areaSize)
    .lineTo(-width / 2, width / 2 + areaSize)
    .closePath()
    .fill(0xaa33ff);

  // Interaction setup
  xGizmo.eventMode = "static";
  yGizmo.eventMode = "static";
  areaGizmo.eventMode = "static";

  xGizmo.cursor = "ew-resize";
  yGizmo.cursor = "ns-resize";
  areaGizmo.cursor = "move";

  xGizmo.hitArea = new Rectangle(-140, -20, 140, 40);

  yGizmo.hitArea = new Rectangle(-20, 0, 40, 140);

  areaGizmo.hitArea = new Rectangle(-width / 2 - areaSize, width / 2, areaSize, areaSize);

  // Put area on top
  xGizmo.zIndex = 0;
  yGizmo.zIndex = 0;
  areaGizmo.zIndex = 10;

  gizmoLayer.addChild(xGizmo);
  gizmoLayer.addChild(yGizmo);
  gizmoLayer.addChild(areaGizmo);

  stage.addChild(gizmoLayer);

  const dragState = {
    active: false,

    axis: null as "x" | "y" | "both" | null,

    startMouseX: 0,
    startMouseY: 0,

    startObjectX: 0,
    startObjectY: 0,
  };

  const getSelectedObject = () => {
    const object = selectedObjectsStore.getSnapshot()[0]?.object;

    if (
      !object ||
      !hasComponent(object, TransformComponent) ||
      !hasComponent(object, SpriteComponent)
    ) {
      return undefined;
    }

    return object;
  };

  const onDrag = (event: PointerEvent) => {
    if (!dragState.active) return;

    const selected = getSelectedObject();

    if (!selected) return;

    const deltaX = (event.clientX - dragState.startMouseX) / viewport.zoom;

    const deltaY = (event.clientY - dragState.startMouseY) / viewport.zoom;

    if (dragState.axis === "x") {
      selected.position.x = dragState.startObjectX + deltaX;
    }

    if (dragState.axis === "y") {
      selected.position.y = dragState.startObjectY - deltaY;
    }

    if (dragState.axis === "both") {
      selected.position.x = dragState.startObjectX + deltaX;

      selected.position.y = dragState.startObjectY - deltaY;
    }
  };

  const stopDragging = () => {
    dragState.active = false;
    dragState.axis = null;

    window.removeEventListener("pointermove", onDrag);

    window.removeEventListener("pointerup", stopDragging);
  };

  const startDragging = (axis: "x" | "y" | "both") => (event: FederatedPointerEvent) => {
    event.stopPropagation();

    const selected = getSelectedObject();

    if (!selected) return;

    dragState.active = true;
    dragState.axis = axis;

    dragState.startMouseX = event.client.x;
    dragState.startMouseY = event.client.y;

    dragState.startObjectX = selected.position.x;

    dragState.startObjectY = selected.position.y;

    window.addEventListener("pointermove", onDrag);

    window.addEventListener("pointerup", stopDragging);
  };

  xGizmo.on("pointerdown", startDragging("x"));

  yGizmo.on("pointerdown", startDragging("y"));

  areaGizmo.on("pointerdown", startDragging("both"));

  onUpdate(() => {
    const selected = getSelectedObject();

    if (!selected) {
      gizmoLayer.visible = false;
      return;
    }

    gizmoLayer.visible = true;

    gizmoLayer.position.set(-selected.position.x, selected.position.y);
  });

  gameContext.onDispose(() => {
    stopDragging();

    gizmoLayer.destroy({
      children: true,
    });
  });
};
