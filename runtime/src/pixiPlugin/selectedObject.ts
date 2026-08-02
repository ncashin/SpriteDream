import { Container, FederatedPointerEvent, Graphics, Point, Rectangle } from "pixi.js";

import { hasComponent } from "../components";
import type { GameContext } from "../initialization";
import { ParentComponent } from "../parent";
import { isSerializableObject } from "../scene";
import { TransformComponent } from "../transform";
import type { ParentHierarchy } from "./handleParentHierarchy";
import { SpriteComponent, type SpriteObject } from "./sprite";

const getGizmoScale = (gizmoParent: Container, hasParent: boolean): Point => {
  if (!hasParent) {
    return new Point(1, 1);
  }

  return new Point(
    gizmoParent.scale.x === 0 ? 1 : 1 / Math.abs(gizmoParent.scale.x),
    gizmoParent.scale.y === 0 ? 1 : 1 / Math.abs(gizmoParent.scale.y),
  );
};

const hasSceneParent = (object: SpriteObject, scene: GameContext["scene"]): boolean => {
  if (!hasComponent(object, ParentComponent)) return false;

  const parentKey = object.parent;
  if (!parentKey || parentKey === "undefined") return false;

  return isSerializableObject(scene[parentKey]);
};

const getArrowAxisInGlobalSpace = (gizmoLayer: Container, axis: "x" | "y"): Point => {
  const origin = gizmoLayer.getGlobalPosition(new Point());
  const tip = gizmoLayer.toGlobal(axis === "x" ? new Point(-100, 0) : new Point(0, 100));
  const direction = new Point(tip.x - origin.x, tip.y - origin.y);
  const length = Math.hypot(direction.x, direction.y);

  if (length === 0) {
    return axis === "x" ? new Point(1, 0) : new Point(0, 1);
  }

  return new Point(direction.x / length, direction.y / length);
};

export const handleSelectedObjects = (gameContext: GameContext, hierarchy: ParentHierarchy) => {
  const { onUpdate, selectedObjectsStore, scene } = gameContext;

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

  xGizmo.cursor = "pointer";
  yGizmo.cursor = "pointer";
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

  const dragState = {
    active: false,

    axis: null as "x" | "y" | "both" | null,

    startMouseX: 0,
    startMouseY: 0,

    startObjectX: 0,
    startObjectY: 0,

    startWorldX: 0,
    startWorldY: 0,
  };

  const getSelected = (): { key: string; object: SpriteObject } | undefined => {
    const selected = selectedObjectsStore.getSnapshot()[0];

    if (
      !selected?.object ||
      !hasComponent(selected.object, TransformComponent) ||
      !hasComponent(selected.object, SpriteComponent)
    ) {
      return undefined;
    }

    return { key: selected.key, object: selected.object };
  };

  const parentDeltaFromScreen = (
    gizmoParent: Container,
    screenDeltaX: number,
    screenDeltaY: number,
  ): Point => {
    const localOrigin = gizmoParent.toLocal(new Point(0, 0));
    const localDeltaEnd = gizmoParent.toLocal(new Point(screenDeltaX, screenDeltaY));

    return new Point(localDeltaEnd.x - localOrigin.x, localDeltaEnd.y - localOrigin.y);
  };

  const applyAxisDrag = (
    container: Container,
    gizmoLayer: Container,
    object: SpriteObject,
    axis: "x" | "y",
    screenDeltaX: number,
    screenDeltaY: number,
  ) => {
    const parent = container.parent;

    if (!parent) return;

    const arrowAxis = getArrowAxisInGlobalSpace(gizmoLayer, axis);
    const travel = screenDeltaX * arrowAxis.x + screenDeltaY * arrowAxis.y;
    const targetWorld = new Point(
      dragState.startWorldX + travel * arrowAxis.x,
      dragState.startWorldY + travel * arrowAxis.y,
    );
    const targetLocal = parent.toLocal(targetWorld);

    object.position.x = -targetLocal.x;
    object.position.y = targetLocal.y;
  };

  const applyDragDelta = (
    container: Container,
    gizmoLayer: Container,
    object: SpriteObject,
    screenDeltaX: number,
    screenDeltaY: number,
  ) => {
    const gizmoParent = gizmoLayer.parent;

    if (!gizmoParent) return;

    if (dragState.axis === "x") {
      applyAxisDrag(container, gizmoLayer, object, "x", screenDeltaX, screenDeltaY);
      return;
    }

    if (dragState.axis === "y") {
      applyAxisDrag(container, gizmoLayer, object, "y", screenDeltaX, screenDeltaY);
      return;
    }

    const parentDelta = parentDeltaFromScreen(gizmoParent, screenDeltaX, screenDeltaY);

    object.position.x = dragState.startObjectX - parentDelta.x;
    object.position.y = dragState.startObjectY + parentDelta.y;
  };

  const onDrag = (event: PointerEvent) => {
    if (!dragState.active) return;

    const selected = getSelected();

    if (!selected) return;

    const container = hierarchy.getContainer(selected.key);
    const screenDeltaX = event.clientX - dragState.startMouseX;
    const screenDeltaY = event.clientY - dragState.startMouseY;

    applyDragDelta(container, gizmoLayer, selected.object, screenDeltaX, screenDeltaY);
  };

  const stopDragging = () => {
    dragState.active = false;
    dragState.axis = null;

    window.removeEventListener("pointermove", onDrag);

    window.removeEventListener("pointerup", stopDragging);
  };

  const startDragging = (axis: "x" | "y" | "both") => (event: FederatedPointerEvent) => {
    event.stopPropagation();

    const selected = getSelected();

    if (!selected) return;

    const container = hierarchy.getContainer(selected.key);
    const world = container.getGlobalPosition(new Point());

    dragState.active = true;
    dragState.axis = axis;

    dragState.startMouseX = event.client.x;
    dragState.startMouseY = event.client.y;

    dragState.startObjectX = selected.object.position.x;
    dragState.startObjectY = selected.object.position.y;
    dragState.startWorldX = world.x;
    dragState.startWorldY = world.y;

    window.addEventListener("pointermove", onDrag);

    window.addEventListener("pointerup", stopDragging);
  };

  xGizmo.on("pointerdown", startDragging("x"));

  yGizmo.on("pointerdown", startDragging("y"));

  areaGizmo.on("pointerdown", startDragging("both"));

  onUpdate(() => {
    const selected = getSelected();

    if (!selected) {
      gizmoLayer.visible = false;
      gizmoLayer.parent?.removeChild(gizmoLayer);
      return;
    }

    const container = hierarchy.getContainer(selected.key);
    const gizmoParent = container.parent;

    if (!gizmoParent) {
      gizmoLayer.visible = false;
      return;
    }

    if (gizmoLayer.parent !== gizmoParent) {
      gizmoLayer.parent?.removeChild(gizmoLayer);
      gizmoParent.addChild(gizmoLayer);
    }

    gizmoLayer.visible = true;
    gizmoLayer.position.set(container.position.x, container.position.y);
    gizmoLayer.rotation = container.rotation;

    const counterScale = getGizmoScale(gizmoParent, hasSceneParent(selected.object, scene));
    gizmoLayer.scale.set(counterScale.x, counterScale.y);
  });

  gameContext.onDispose(() => {
    stopDragging();

    gizmoLayer.parent?.removeChild(gizmoLayer);

    gizmoLayer.destroy({
      children: true,
    });
  });
};
