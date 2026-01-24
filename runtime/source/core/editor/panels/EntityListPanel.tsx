import { useState, useEffect, useMemo, useRef } from "react";
import type { Entity } from "../../ecs/ecs";
import { useGameContext, startUndoAction, undo, redo, copyEntity, pasteEntity, hasClipboardData } from "../useGameContext.tsx";
import { useECS, useSceneEntities, useSelectedEntity } from "../useECS.tsx";
import { CaretDown, CaretRight, Plus, PencilSimple, Trash } from "@phosphor-icons/react";
import { getChildren, getParents, setWorldPosition } from "../../transform";
import { getViewport } from "../../viewport/viewportPlugin";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";

function screenToWorld(
  screenX: number,
  screenY: number,
  viewportX: number,
  viewportY: number,
  viewportScale: number,
  canvasWidth: number,
  canvasHeight: number
): { x: number; y: number } {
  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;
  return {
    x: (screenX - centerX) / viewportScale + viewportX,
    y: (screenY - centerY) / viewportScale + viewportY,
  };
}

function isDescendant(ecs: any, parent: Entity, child: Entity): boolean {
  const children = getChildren(ecs.ecsInstance, parent);
  if (children.includes(child)) return true;
  for (const c of children) {
    if (isDescendant(ecs, c, child)) return true;
  }
  return false;
}

function DroppableContainer({
  children,
  overId,
}: {
  children: React.ReactNode;
  overId: Entity | string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'entity-list-container',
  });

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[120px] ${(isOver || overId === 'entity-list-container') ? 'bg-[var(--vscode-list-activeSelectionBackground,#04395e)]' : ''}`}
    >
      {children}
    </div>
  );
}

function DraggableEntityItem({
  entity,
  hoveredEntity,
  renamingEntity,
  renameValue,
  renameInputRef,
  expandedEntities,
  overId,
  onHover,
  onStartRename,
  onRenameSubmit,
  onRenameKeyDown,
  onRenameChange,
  onDelete,
  onToggleExpand,
}: {
  entity: Entity;
  hoveredEntity: Entity | null;
  renamingEntity: Entity | null;
  renameValue: string;
  renameInputRef: (node: HTMLInputElement | null) => void;
  expandedEntities: Set<Entity>;
  overId: Entity | string | null;
  onHover: (entity: Entity | null) => void;
  onStartRename: (entity: Entity, e: React.MouseEvent) => void;
  onRenameSubmit: (e: React.FormEvent) => void;
  onRenameKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onRenameChange: (value: string) => void;
  onDelete: (entity: Entity, e: React.MouseEvent) => void;
  onToggleExpand: (entity: Entity, e: React.MouseEvent) => void;
}) {
  const gameContext = useGameContext();
  const ecs = gameContext?.ecs as any;
  const selectedEntity = useSelectedEntity();

  const { attributes, listeners, setNodeRef, transform: dragTransform, isDragging } = useDraggable({
    id: entity,
  });

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: entity,
  });

  const children = getChildren(ecs.ecsInstance, entity);
  const hasChildren = children.length > 0;
  const isExpanded = expandedEntities.has(entity);

  const components = ecs.ecsInstance.entities[entity];
  const transform = components?.transform;
  const isChild = transform && transform.parent;

  const dragElementRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const element = dragElementRef.current;
    if (element && dragTransform) {
      element.style.transform = `translate3d(${dragTransform.x}px, ${dragTransform.y}px, 0)`;
    } else if (element) {
      element.style.transform = '';
    }
  }, [dragTransform]);

  const bgColor = (isOver || overId === entity)
    ? 'bg-[var(--vscode-list-activeSelectionBackground,#04395e)]'
    : selectedEntity === entity
      ? 'bg-[var(--vscode-list-activeSelectionBackground,#04395e)]'
      : hoveredEntity === entity
        ? 'bg-[var(--vscode-list-hoverBackground,rgba(255,255,255,0.1))]'
        : isChild
          ? 'bg-[var(--vscode-list-inactiveSelectionBackground,rgba(0,0,0,0.15))]'
          : '';

  const combinedRef = (node: HTMLSpanElement | null) => {
    dragElementRef.current = node;
    if (setNodeRef) {
      setNodeRef(node);
    }
  };

  return (
    <div
      ref={setDroppableRef}
      className={`flex items-center gap-1 min-h-5 px-2 py-1 text-xs cursor-pointer transition-colors duration-100 text-[var(--vscode-foreground,#cccccc)] ${bgColor} ${isDragging ? 'opacity-50' : ''}`}
      onClick={() => ecs.selectEntity(entity)}
      onMouseEnter={() => onHover(entity)}
      onMouseLeave={() => onHover(null)}
    >
      {renamingEntity === entity ? (
        <form
          onSubmit={onRenameSubmit}
          className="flex flex-1 min-w-0"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            ref={renameInputRef}
            type="text"
            value={renameValue}
            onChange={(e) => onRenameChange(e.target.value)}
            onKeyDown={onRenameKeyDown}
            onBlur={onRenameSubmit}
            className="flex-1 p-0 text-xs bg-transparent text-[#cccccc] border-none outline-none overflow-hidden text-ellipsis whitespace-nowrap min-w-0 w-full"
          />
        </form>
      ) : (
        <>
          <span
            ref={combinedRef}
            className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap cursor-grab active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            {entity}
          </span>
          <div className="flex items-center gap-1.5">
            {hoveredEntity === entity && (
              <div
                className="flex gap-1.5 items-center"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <button
                  className="bg-transparent border-none cursor-pointer p-0 rounded-md flex items-center justify-center transition-colors duration-100 text-[var(--vscode-foreground,rgba(255,255,255,0.9))] hover:bg-[var(--vscode-list-hoverBackground,rgba(255,255,255,0.1))]"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStartRename(entity, e);
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  title="Rename entity"
                >
                  <PencilSimple size={14} weight="bold" />
                </button>
                <button
                  className="bg-transparent border-none cursor-pointer p-0 rounded-md flex items-center justify-center transition-colors duration-100 text-[var(--vscode-errorForeground,#f48771)] hover:bg-[var(--vscode-list-hoverBackground,rgba(255,255,255,0.1))]"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(entity, e);
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  title="Delete entity"
                >
                  <Trash size={14} weight="bold" />
                </button>
              </div>
            )}
            {hasChildren && (
              <button
                className="bg-transparent border-none cursor-pointer p-0 flex items-center justify-center transition-colors duration-100 text-[var(--vscode-foreground,rgba(255,255,255,0.7))] hover:text-[var(--vscode-foreground,rgba(255,255,255,0.9))]"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleExpand(entity, e);
                }}
                onMouseDown={(e) => e.stopPropagation()}
                title={isExpanded ? "Collapse" : "Expand"}
              >
                {isExpanded ? (
                  <CaretDown size={12} weight="bold" />
                ) : (
                  <CaretRight size={12} weight="bold" />
                )}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function EntityListPanel() {
  const gameContext = useGameContext();
  const ecs = gameContext?.ecs as any;

  useECS();

  const entities = useSceneEntities();
  const selectedEntity = useSelectedEntity();

  const [isExpanded, setIsExpanded] = useState(true);
  const [hoveredEntity, setHoveredEntity] = useState<Entity | null>(null);
  const [renamingEntity, setRenamingEntity] = useState<Entity | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [activeId, setActiveId] = useState<Entity | null>(null);
  const [overId, setOverId] = useState<Entity | string | null>(null);
  const [manuallyExpandedEntities, setManuallyExpandedEntities] = useState<Set<Entity>>(new Set());
  const previousSelectedEntityRef = useRef<Entity | null>(null);

  const autoExpandedEntities = useMemo(() => {
    if (!ecs || !selectedEntity) return new Set<Entity>();

    const autoExpanded = new Set<Entity>();

    const children = getChildren(ecs.ecsInstance, selectedEntity);
    if (children.length > 0) {
      autoExpanded.add(selectedEntity);
    }

    const parents = getParents(ecs.ecsInstance, selectedEntity);
    for (const parent of parents) {
      autoExpanded.add(parent);
    }

    return autoExpanded;
  }, [selectedEntity, ecs]);

  const expandedEntities = useMemo(() => {
    if (!ecs) return new Set<Entity>();

    const previousEntity = previousSelectedEntityRef.current;
    const final = new Set<Entity>();

    for (const entity of manuallyExpandedEntities) {
      final.add(entity);
    }

    for (const entity of autoExpandedEntities) {
      if (previousEntity && previousEntity !== selectedEntity) {
        const wasAutoExpandedForPrevious = previousEntity &&
          (entity === previousEntity || getParents(ecs.ecsInstance, previousEntity).includes(entity));

        if (wasAutoExpandedForPrevious && !manuallyExpandedEntities.has(entity)) {
          if (selectedEntity && isDescendant(ecs, entity, selectedEntity)) {
            final.add(entity);
          }
        } else {
          final.add(entity);
        }
      } else {
        final.add(entity);
      }
    }

    previousSelectedEntityRef.current = selectedEntity;
    return final;
  }, [selectedEntity, ecs, autoExpandedEntities, manuallyExpandedEntities]);

  const renameInputRefCallback = (node: HTMLInputElement | null) => {
    if (node && renamingEntity) {
      setTimeout(() => {
        node.focus();
        node.select();
      }, 0);
    }
  };

  useEffect(() => {
    if (!ecs) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedEntity) {
        e.preventDefault();
        startUndoAction();
        ecs.destroyEntity(selectedEntity);
        setHoveredEntity(null);
        setManuallyExpandedEntities((prev) => {
          const next = new Set(prev);
          next.delete(selectedEntity);
          return next;
        });
        return;
      }

      const isModifierPressed = e.ctrlKey || e.metaKey;
      if (!isModifierPressed) return;

      e.preventDefault();

      if (e.key === 'z' && !e.shiftKey) {
        undo();
        return;
      }

      if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
        redo();
        return;
      }

      if (e.key === 'c' && selectedEntity) {
        const components = ecs.getEntity(selectedEntity);
        copyEntity(selectedEntity, components);
        return;
      }

      if (e.key === 'v' && hasClipboardData()) {
        const allEntities = Object.keys(ecs.ecsInstance.entities);
        const pasted = pasteEntity(allEntities);
        if (pasted) {
          startUndoAction();

          ecs.createEntity(pasted.entityName);

          const entityProxy = ecs.getEntity(pasted.entityName);
          for (const component of Object.values(pasted.components)) {
            if (component && typeof component === 'object' && 'type' in component) {
              entityProxy[component.type] = component;
            }
          }

          if (gameContext?.input && typeof gameContext.input === 'object' && gameContext.input !== null && 'getMousePosition' in gameContext.input) {
            const mousePos = (gameContext.input as { getMousePosition: () => { x: number; y: number } }).getMousePosition();
            const viewportState = getViewport();
            const canvas = (gameContext.canvas as HTMLCanvasElement) || document.querySelector("canvas") as HTMLCanvasElement | null;
            if (canvas) {
              const rect = canvas.getBoundingClientRect();
              const worldPos = screenToWorld(
                mousePos.x,
                mousePos.y,
                viewportState.x,
                viewportState.y,
                viewportState.scale,
                rect.width,
                rect.height
              );
              setWorldPosition(ecs.ecsInstance, pasted.entityName, worldPos.x, worldPos.y);
            }
          }

          ecs.selectEntity(pasted.entityName);
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [ecs, selectedEntity]);

  if (!ecs) return null;

  const handleCreateEntity = () => {
    const allEntities = Object.keys(ecs.ecsInstance.entities);
    let entityName = "newEntity";
    let counter = 0;

    while (allEntities.includes(entityName)) {
      counter++;
      entityName = `newEntity${counter}`;
    }

    startUndoAction();

    const newEntity = ecs.createEntity(entityName);
    ecs.selectEntity(newEntity);
  };

  const handleDeleteEntity = (entity: Entity, e: React.MouseEvent) => {
    e.stopPropagation();

    startUndoAction();

    ecs.destroyEntity(entity);
    setHoveredEntity(null);
    setManuallyExpandedEntities((prev) => {
      const next = new Set(prev);
      next.delete(entity);
      return next;
    });
  };

  const handleStartRename = (entity: Entity, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingEntity(entity);
    setRenameValue(entity);
  };

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!renamingEntity) return;

    const newName = renameValue.trim();
    if (newName && newName !== renamingEntity) {
      startUndoAction();

      const success = ecs.renameEntity(renamingEntity, newName);
      if (success) {
        setManuallyExpandedEntities((prev) => {
          const next = new Set(prev);
          if (next.has(renamingEntity)) {
            next.delete(renamingEntity);
            next.add(newName);
          }
          return next;
        });
      }
    }

    setRenamingEntity(null);
    setRenameValue("");
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setRenamingEntity(null);
      setRenameValue("");
    } else if (e.key === "Enter") {
      handleRenameSubmit(e);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as Entity);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      setOverId(null);
      return;
    }

    const draggedEntity = active.id as Entity;
    const targetId = over.id;

    if (targetId === 'entity-list-container') {
      setOverId('entity-list-container');
      return;
    }

    const targetEntity = targetId as Entity;

    if (draggedEntity === targetEntity) {
      setOverId(null);
      return;
    }

    if (isDescendant(ecs, draggedEntity, targetEntity)) {
      setOverId(null);
      return;
    }

    setOverId(targetEntity);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const draggedEntity = active.id as Entity;

    if (!over || active.id === over.id) {
      setActiveId(null);
      setOverId(null);
      return;
    }

    const targetId = over.id;

    if (targetId === 'entity-list-container') {
      ecs.setParent(draggedEntity, null);
      setActiveId(null);
      setOverId(null);
      return;
    }

    const targetEntity = targetId as Entity;

    if (isDescendant(ecs, draggedEntity, targetEntity)) {
      setActiveId(null);
      setOverId(null);
      return;
    }

    ecs.setParent(draggedEntity, targetEntity);

    setActiveId(null);
    setOverId(null);
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setOverId(null);
  };

  const toggleExpand = (entity: Entity, e: React.MouseEvent) => {
    e.stopPropagation();
    setManuallyExpandedEntities((prev) => {
      const next = new Set(prev);
      if (next.has(entity)) {
        next.delete(entity);
      } else {
        next.add(entity);
      }
      return next;
    });
  };

  const getVisibleEntities = (): Entity[] => {
    const allEntities = Object.keys(ecs.ecsInstance.entities);
    const result: Entity[] = [];
    const visited = new Set<Entity>();

    const rootEntities = allEntities.filter((entity) => {
      const components = ecs.ecsInstance.entities[entity];
      const transform = components?.transform;
      return !transform || !transform.parent;
    });

    const addEntity = (entity: Entity) => {
      if (visited.has(entity)) return;
      visited.add(entity);

      result.push(entity);

      if (expandedEntities.has(entity)) {
        const children = getChildren(ecs.ecsInstance, entity);
        for (const child of children) {
          addEntity(child);
        }
      }
    };

    for (const root of rootEntities) {
      addEntity(root);
    }

    return result;
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  return (
    <div
      className="flex flex-col w-[250px] rounded-sm font-[var(--vscode-font-family,system-ui,-apple-system,sans-serif)] bg-[var(--vscode-panel-background,#3c3c3c)]"
    >
      <button
        className={`flex items-center justify-between w-full min-h-5 px-2 py-1 text-xs cursor-pointer outline-none select-none transition-colors duration-100 bg-transparent text-[var(--vscode-foreground,rgba(255,255,255,0.9))] hover:bg-[var(--vscode-list-hoverBackground,rgba(255,255,255,0.1))] ${isExpanded ? "rounded-t-sm border-b border-[var(--vscode-panel-border,rgba(128,128,128,0.2))]" : "rounded-sm"}`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span>Entities ({entities.length})</span>
        {isExpanded ? (
          <CaretDown size={12} weight="bold" className="ml-1" />
        ) : (
          <CaretRight size={12} weight="bold" className="ml-1" />
        )}
      </button>

      {isExpanded && (
        <>
          <button
            className="flex items-center gap-1 w-full min-h-5 px-2 py-1 text-xs cursor-pointer border-b border-[var(--vscode-panel-border,rgba(128,128,128,0.2))] transition-colors duration-100 text-[var(--vscode-foreground,#cccccc)] bg-[var(--vscode-list-inactiveSelectionBackground,rgba(0,0,0,0.1))] hover:bg-[var(--vscode-list-hoverBackground,rgba(128,128,128,0.35))] active:bg-[var(--vscode-list-hoverBackground,rgba(128,128,128,0.4))]"
            onClick={handleCreateEntity}
          >
            <Plus size={12} weight="bold" />
            <span>New Entity</span>
          </button>

          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <DroppableContainer overId={overId}>
              <div className="overflow-auto p-0 pb-1 h-[120px] rounded-b-sm bg-[var(--vscode-list-inactiveSelectionBackground,rgba(0,0,0,0.1))]">
                {entities.length === 0 ? (
                  <div className="flex items-center justify-center min-h-5 px-2 py-1 text-xs text-[var(--vscode-descriptionForeground,rgba(255,255,255,0.6))]">
                    No entities
                  </div>
                ) : (
                  getVisibleEntities().map((entity) => (
                    <DraggableEntityItem
                      key={entity}
                      entity={entity}
                      hoveredEntity={hoveredEntity}
                      renamingEntity={renamingEntity}
                      renameValue={renameValue}
                      renameInputRef={renameInputRefCallback}
                      expandedEntities={expandedEntities}
                      overId={overId}
                      onHover={setHoveredEntity}
                      onStartRename={handleStartRename}
                      onRenameSubmit={handleRenameSubmit}
                      onRenameKeyDown={handleRenameKeyDown}
                      onRenameChange={setRenameValue}
                      onDelete={handleDeleteEntity}
                      onToggleExpand={toggleExpand}
                    />
                  ))
                )}
              </div>
            </DroppableContainer>
            <DragOverlay>
              {activeId ? (
                <div className="flex items-center gap-1 min-h-5 px-2 py-1 text-xs cursor-pointer opacity-50 text-[var(--vscode-foreground,#cccccc)] bg-[var(--vscode-list-inactiveSelectionBackground,rgba(0,0,0,0.15))]">
                  <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                    {activeId}
                  </span>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </>
      )}
    </div>
  );
}

