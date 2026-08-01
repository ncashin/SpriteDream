import { Container, FederatedPointerEvent, Graphics, Rectangle } from "pixi.js";
import { hasComponent } from "../components";
import type { GameContext } from "../initialization";
import { TransformComponent } from "../transform";
import { SpriteComponent } from "./sprite";

export const handleSelectedObjects = (
  gameContext: GameContext,
  stage: Container,
) => {
  const { onUpdate, selectedObjectsStore } = gameContext;

  const gizmoLayer = new Container();
  gizmoLayer.zIndex = 9999;
  gizmoLayer.sortableChildren = true;

  const gizmo = new Graphics();

  gizmo.eventMode = "static";
  gizmo.cursor = "pointer";
  gizmo.hitArea = new Rectangle(-50, -20, 100, 160);

  gizmoLayer.addChild(gizmo);
  stage.addChild(gizmoLayer);

  const dragState = {
    active: false,
    startY: 0,
    startObjectY: 0,
  };

  const getSelectedObject = () => {
    const selectedEntry = selectedObjectsStore.getSnapshot()[0];
    const object = selectedEntry?.object;

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


    const deltaY = event.clientY - dragState.startY;

    selected.position.y = dragState.startObjectY - deltaY;
  };

  const stopDragging = () => {
    if (!dragState.active) return;

    dragState.active = false;

    window.removeEventListener("pointermove", onDrag);
    window.removeEventListener("pointerup", stopDragging);
  };

  const startDragging = (event: FederatedPointerEvent) => {
    event.stopPropagation();

    const selected = getSelectedObject();

    if (!selected) return;

    dragState.active = true;
    dragState.startY = event.client.y;
    dragState.startObjectY = selected.position.y;

    window.addEventListener("pointermove", onDrag);
    window.addEventListener("pointerup", stopDragging);
  };

  gizmo.on("pointerdown", startDragging);

  gizmo
    .moveTo(0, 0)
    .lineTo(0, 100)
    .stroke({ color: 0x00ff00, width: 5 });

  gizmo
    .moveTo(-10, 100)
    .lineTo(10, 100)
    .lineTo(0, 120)
    .lineTo(-10, 100)
    .fill(0x00ff00);

  onUpdate(() => {
    const selected = getSelectedObject();

    if (!selected) {
      gizmo.visible = false;
      return;
    }

    gizmo.visible = true;

    const { position } = selected;

    gizmo.position.set(-position.x, position.y);
  });

  gameContext.onDispose(() => {
    stopDragging();

    gizmoLayer.destroy({
      children: true,
    });
  });
};