import { useState, useEffect, useRef } from "react";
import type { Entity } from "../../ecs/ecs";
import { useGameContext, startUndoAction, undo, redo, copyEntity, pasteEntity, hasClipboardData } from "../EditorContext";
import { addDrawCallback, removeDrawCallback } from "../../gameloop";
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

// Helper function to convert screen coordinates to world coordinates
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

// Helper function to check if an entity is a descendant
function isDescendant(ecs: any, parent: Entity, child: Entity): boolean {
  const children = getChildren(ecs.ecsInstance, parent);
  if (children.includes(child)) return true;
  for (const c of children) {
    if (isDescendant(ecs, c, child)) return true;
  }
  return false;
}

// Droppable Container Component for unparenting
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
      style={{
        minHeight: '120px',
        backgroundColor: (isOver || overId === 'entity-list-container')
          ? 'var(--vscode-list-activeSelectionBackground, #04395e)'
          : undefined,
      }}
    >
      {children}
    </div>
  );
}

// Draggable Entity Item Component
function DraggableEntityItem({
  entity,
  ecs,
  selectedEntity,
  hoveredEntity,
  renamingEntity,
  renameValue,
  renameInputRef,
  expandedEntities,
  overId,
  onSelect,
  onHover,
  onStartRename,
  onRenameSubmit,
  onRenameKeyDown,
  onRenameChange,
  onDelete,
  onToggleExpand,
}: {
  entity: Entity;
  ecs: any;
  selectedEntity: Entity | null;
  hoveredEntity: Entity | null;
  renamingEntity: Entity | null;
  renameValue: string;
  renameInputRef: React.RefObject<HTMLInputElement>;
  expandedEntities: Set<Entity>;
  overId: Entity | string | null;
  activeId: Entity | null;
  onSelect: (entity: Entity) => void;
  onHover: (entity: Entity | null) => void;
  onStartRename: (entity: Entity, e: React.MouseEvent) => void;
  onRenameSubmit: (e: React.FormEvent) => void;
  onRenameKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onRenameChange: (value: string) => void;
  onDelete: (entity: Entity, e: React.MouseEvent) => void;
  onToggleExpand: (entity: Entity, e: React.MouseEvent) => void;
}) {
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

  const dragStyle = dragTransform
    ? {
      transform: `translate3d(${dragTransform.x}px, ${dragTransform.y}px, 0)`,
    }
    : undefined;

  return (
    <div
      ref={setDroppableRef}
      className={`
        flex items-center gap-1 min-h-5 px-2 py-1
        text-xs cursor-pointer
        transition-colors duration-100
        ${isDragging ? 'opacity-50' : ''}
      `}
      style={{
        color: 'var(--vscode-foreground, #cccccc)',
        backgroundColor: (isOver || overId === entity)
          ? 'var(--vscode-list-activeSelectionBackground, #04395e)'
          : selectedEntity === entity
            ? 'var(--vscode-list-activeSelectionBackground, #04395e)'
            : hoveredEntity === entity
              ? 'var(--vscode-list-hoverBackground, rgba(255, 255, 255, 0.1))'
              : isChild
                ? 'var(--vscode-list-inactiveSelectionBackground, rgba(0, 0, 0, 0.15))'
                : 'transparent',
        opacity: isDragging ? 0.5 : undefined,
      }}
      onClick={() => onSelect(entity)}
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
            className="
              flex-1 p-0 text-xs bg-transparent text-[#cccccc]
              border-none outline-none overflow-hidden
              text-ellipsis whitespace-nowrap min-w-0 w-full
            "
          />
        </form>
      ) : (
        <>
          <span
            ref={setNodeRef}
            className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap cursor-grab active:cursor-grabbing"
            style={dragStyle}
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
                  className="
                    bg-transparent border-none cursor-pointer p-0
                    rounded-md flex items-center justify-center
                    transition-colors duration-100
                  "
                  style={{
                    color: 'var(--vscode-foreground, rgba(255, 255, 255, 0.9))',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground, rgba(255, 255, 255, 0.1))';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
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
                  className="
                    bg-transparent border-none cursor-pointer p-0
                    rounded-md flex items-center justify-center
                    transition-colors duration-100
                  "
                  style={{
                    color: 'var(--vscode-errorForeground, #f48771)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground, rgba(255, 255, 255, 0.1))';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
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
                className="
                                bg-transparent border-none cursor-pointer p-0
                                flex items-center justify-center
                                transition-colors duration-100
                              "
                style={{
                  color: 'var(--vscode-foreground, rgba(255, 255, 255, 0.7))',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--vscode-foreground, rgba(255, 255, 255, 0.9))';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--vscode-foreground, rgba(255, 255, 255, 0.7))';
                }}
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
  const [isExpanded, setIsExpanded] = useState(true);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [hoveredEntity, setHoveredEntity] = useState<Entity | null>(null);
  const [renamingEntity, setRenamingEntity] = useState<Entity | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const [activeId, setActiveId] = useState<Entity | null>(null);
  const [overId, setOverId] = useState<Entity | string | null>(null);
  const [expandedEntities, setExpandedEntities] = useState<Set<Entity>>(new Set());
  const [manuallyExpandedEntities, setManuallyExpandedEntities] = useState<Set<Entity>>(new Set());
  const previousSelectedEntityRef = useRef<Entity | null>(null);

  // Sync entities from ECS
  useEffect(() => {
    if (!ecs) return;

    const updateEntities = () => {
      const allEntities = Object.keys(ecs.ecsInstance.entities);
      setEntities((prev) => {
        if (
          prev.length !== allEntities.length ||
          !prev.every((e, i) => e === allEntities[i])
        ) {
          return allEntities;
        }
        return prev;
      });
    };

    updateEntities();
    const callbackId = addDrawCallback(updateEntities);

    return () => {
      removeDrawCallback(callbackId);
    };
  }, [ecs]);

  // Sync selected entity
  useEffect(() => {
    if (!ecs) return;

    const updateSelection = () => {
      setSelectedEntity(ecs.getSelectedEntity() ?? null);
    };

    updateSelection();
    const callbackId = addDrawCallback(updateSelection);

    return () => {
      removeDrawCallback(callbackId);
    };
  }, [ecs]);

  // Auto-expand parent when selected, collapse when deselected
  useEffect(() => {
    if (!ecs) return;

    const previousEntity = previousSelectedEntityRef.current;

    // Handle deselection: collapse previous entity and its parents if they were only temporarily expanded
    if (previousEntity && previousEntity !== selectedEntity) {
      setExpandedEntities((prev) => {
        const next = new Set(prev);
        let changed = false;

        // Collapse the previous entity if it wasn't manually expanded
        if (!manuallyExpandedEntities.has(previousEntity) && prev.has(previousEntity)) {
          next.delete(previousEntity);
          changed = true;
        }

        // Collapse all parents of the previous entity if they weren't manually expanded
        // But keep them expanded if the newly selected entity is a descendant
        const parents = getParents(ecs.ecsInstance, previousEntity);
        for (const parent of parents) {
          if (!manuallyExpandedEntities.has(parent) && prev.has(parent)) {
            // Don't collapse if the newly selected entity is a descendant of this parent
            const shouldKeepExpanded = selectedEntity && isDescendant(ecs, parent, selectedEntity);

            if (!shouldKeepExpanded) {
              next.delete(parent);
              changed = true;
            }
          }
        }

        return changed ? next : prev;
      });
    }

    // Handle selection: temporarily expand entity and all its parents
    if (selectedEntity) {
      setExpandedEntities((prev) => {
        const next = new Set(prev);
        let changed = false;

        // Expand the selected entity if it has children
        const children = getChildren(ecs.ecsInstance, selectedEntity);
        if (children.length > 0 && !prev.has(selectedEntity)) {
          next.add(selectedEntity);
          changed = true;
        }

        // Expand all parent entities so the selected entity is visible
        const parents = getParents(ecs.ecsInstance, selectedEntity);
        for (const parent of parents) {
          if (!prev.has(parent)) {
            next.add(parent);
            changed = true;
          }
        }

        return changed ? next : prev;
      });
    }

    // Update the ref for next time
    previousSelectedEntityRef.current = selectedEntity;
  }, [selectedEntity, ecs, manuallyExpandedEntities]);

  // Focus rename input
  useEffect(() => {
    if (renamingEntity && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingEntity]);

  // Keyboard shortcuts for undo/redo, copy/paste, and delete
  useEffect(() => {
    if (!ecs) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle keyboard shortcuts if user is typing in an input field
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Delete: Delete or Backspace key (no modifier required)
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedEntity) {
        e.preventDefault();
        // Start undo action to group all diffs from entity deletion
        startUndoAction();
        ecs.destroyEntity(selectedEntity);
        setHoveredEntity(null);
        // Remove from expanded set if it was there
        setExpandedEntities((prev) => {
          const next = new Set(prev);
          next.delete(selectedEntity);
          return next;
        });
        return;
      }

      // Check for modifier keys (Ctrl on Windows/Linux, Cmd on Mac)
      const isModifierPressed = e.ctrlKey || e.metaKey;
      if (!isModifierPressed) return;

      // Prevent default browser behavior
      e.preventDefault();

      // Undo: Ctrl+Z or Cmd+Z
      if (e.key === 'z' && !e.shiftKey) {
        undo();
        return;
      }

      // Redo: Ctrl+Shift+Z or Cmd+Shift+Z (or Ctrl+Y / Cmd+Y)
      if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
        redo();
        return;
      }

      // Copy: Ctrl+C or Cmd+C
      if (e.key === 'c' && selectedEntity) {
        const components = ecs.getEntity(selectedEntity);
        copyEntity(selectedEntity, components);
        return;
      }

      // Paste: Ctrl+V or Cmd+V
      if (e.key === 'v' && hasClipboardData()) {
        const allEntities = Object.keys(ecs.ecsInstance.entities);
        const pasted = pasteEntity(allEntities);
        if (pasted) {
          // Start undo action to group all diffs from pasting
          startUndoAction();

          // Create the entity
          ecs.createEntity(pasted.entityName);
          
          // Add all components
          const entityProxy = ecs.getEntity(pasted.entityName);
          for (const component of Object.values(pasted.components)) {
            entityProxy[component.type] = component;
          }

          // Position the entity at the mouse location
          if (gameContext?.input) {
            const mousePos = gameContext.input.getMousePosition();
            const viewportState = getViewport();
            const canvas = (gameContext.canvas as HTMLCanvasElement) || document.querySelector("canvas") as HTMLCanvasElement | null;
            if (canvas) {
              const worldPos = screenToWorld(
                mousePos.x,
                mousePos.y,
                viewportState.x,
                viewportState.y,
                viewportState.scale,
                canvas.width,
                canvas.height
              );
              setWorldPosition(ecs.ecsInstance, pasted.entityName, worldPos.x, worldPos.y);
            }
          }

          // Select the pasted entity
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

    // Start undo action to group all diffs from entity creation
    startUndoAction();

    const newEntity = ecs.createEntity(entityName);
    ecs.selectEntity(newEntity);
  };

  const handleDeleteEntity = (entity: Entity, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Start undo action to group all diffs from entity deletion
    startUndoAction();

    ecs.destroyEntity(entity);
    setHoveredEntity(null);
    // Remove from expanded set if it was there
    setExpandedEntities((prev) => {
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
      // Start undo action to group all diffs from entity rename
      startUndoAction();

      const success = ecs.renameEntity(renamingEntity, newName);
      if (success) {
        // Update expanded set with new name
        setExpandedEntities((prev) => {
          const next = new Set(prev);
          if (next.has(renamingEntity)) {
            next.delete(renamingEntity);
            next.add(newName);
          }
          return next;
        });
        // Entity is already selected after rename, no need to call selectEntity
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

    // Special case: container (empty space) is always a valid drop target
    if (targetId === 'entity-list-container') {
      setOverId('entity-list-container');
      return;
    }

    // Otherwise, target should be an entity
    const targetEntity = targetId as Entity;

    // Don't allow dropping on self
    if (draggedEntity === targetEntity) {
      setOverId(null);
      return;
    }

    // Check if target is a descendant (prevent cycles)
    if (isDescendant(ecs, draggedEntity, targetEntity)) {
      setOverId(null);
      return;
    }

    setOverId(targetEntity);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const draggedEntity = active.id as Entity;

    // If dropped on nothing or on self, just clear state
    if (!over || active.id === over.id) {
      setActiveId(null);
      setOverId(null);
      return;
    }

    const targetId = over.id;

    // Special case: if dropped on container (empty space), unparent
    if (targetId === 'entity-list-container') {
      ecs.setParent(draggedEntity, null);
      setActiveId(null);
      setOverId(null);
      return;
    }

    // Otherwise, target should be an entity
    const targetEntity = targetId as Entity;

    // Check if target is a descendant (prevent cycles)
    if (isDescendant(ecs, draggedEntity, targetEntity)) {
      setActiveId(null);
      setOverId(null);
      return;
    }

    // Reparent the entity
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
    setExpandedEntities((prev) => {
      const next = new Set(prev);
      if (next.has(entity)) {
        next.delete(entity);
        // Remove from manually expanded if collapsing
        setManuallyExpandedEntities((prevManual) => {
          const nextManual = new Set(prevManual);
          nextManual.delete(entity);
          return nextManual;
        });
      } else {
        next.add(entity);
        // Mark as manually expanded
        setManuallyExpandedEntities((prevManual) => {
          const nextManual = new Set(prevManual);
          nextManual.add(entity);
          return nextManual;
        });
      }
      return next;
    });
  };

  // Build visible entity list based on expanded state
  const getVisibleEntities = (): Entity[] => {
    const allEntities = Object.keys(ecs.ecsInstance.entities);
    const result: Entity[] = [];
    const visited = new Set<Entity>();

    // Find root entities (no parent)
    const rootEntities = allEntities.filter((entity) => {
      const components = ecs.ecsInstance.entities[entity];
      const transform = components?.transform;
      return !transform || !transform.parent;
    });

    // Recursively add entities and their children (if expanded)
    const addEntity = (entity: Entity) => {
      if (visited.has(entity)) return; // Prevent cycles
      visited.add(entity);

      result.push(entity);

      // Only add children if this entity is expanded
      if (expandedEntities.has(entity)) {
        const children = getChildren(ecs.ecsInstance, entity);
        for (const child of children) {
          addEntity(child);
        }
      }
    };

    // Add all root entities
    for (const root of rootEntities) {
      addEntity(root);
    }

    // Don't add orphaned entities - they might be children of collapsed parents
    // Only show entities that are either root entities or have an expanded parent chain
    return result;
  };

  // Configure sensors with activation distance to prevent accidental drags
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px of movement before starting drag
      },
    })
  );

  return (
    <div
      className="flex flex-col w-[250px] rounded-sm"
      style={{
        fontFamily: 'var(--vscode-font-family, system-ui, -apple-system, sans-serif)',
        backgroundColor: 'var(--vscode-panel-background, #3c3c3c)',
      }}
    >
      {/* Header */}
      <button
        className={`
          flex items-center justify-between w-full min-h-5 px-2 py-1
          text-xs cursor-pointer outline-none select-none
          transition-colors duration-100 bg-transparent
          ${isExpanded
            ? "rounded-t-sm border-b"
            : "rounded-sm"
          }
        `}
        style={{
          color: 'var(--vscode-foreground, rgba(255, 255, 255, 0.9))',
          borderBottomColor: isExpanded ? 'var(--vscode-panel-border, rgba(128, 128, 128, 0.2))' : 'transparent',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground, rgba(255, 255, 255, 0.1))';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
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
          {/* New Entity Button */}
          <button
            className="
              flex items-center gap-1 w-full min-h-5 px-2 py-1
              text-xs cursor-pointer border-b
              transition-colors duration-100
            "
            style={{
              color: 'var(--vscode-foreground, #cccccc)',
              backgroundColor: 'var(--vscode-list-inactiveSelectionBackground, rgba(0, 0, 0, 0.1))',
              borderBottomColor: 'var(--vscode-panel-border, rgba(128, 128, 128, 0.2))',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground, rgba(128, 128, 128, 0.35))';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--vscode-list-inactiveSelectionBackground, rgba(0, 0, 0, 0.1))';
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground, rgba(128, 128, 128, 0.4))';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground, rgba(128, 128, 128, 0.35))';
            }}
            onClick={handleCreateEntity}
          >
            <Plus size={12} weight="bold" />
            <span>New Entity</span>
          </button>

          {/* Entity List */}
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <DroppableContainer overId={overId}>
              <div
                className="overflow-auto p-0 pb-1 h-[120px] rounded-b-sm"
                style={{
                  backgroundColor: 'var(--vscode-list-inactiveSelectionBackground, rgba(0, 0, 0, 0.1))',
                }}
              >
                {entities.length === 0 ? (
                  <div
                    className="flex items-center justify-center min-h-5 px-2 py-1 text-xs"
                    style={{
                      color: 'var(--vscode-descriptionForeground, rgba(255, 255, 255, 0.6))',
                    }}
                  >
                    No entities
                  </div>
                ) : (
                  getVisibleEntities().map((entity) => (
                    <DraggableEntityItem
                      key={entity}
                      entity={entity}
                      ecs={ecs}
                      selectedEntity={selectedEntity}
                      hoveredEntity={hoveredEntity}
                      renamingEntity={renamingEntity}
                      renameValue={renameValue}
                      renameInputRef={renameInputRef}
                      expandedEntities={expandedEntities}
                      overId={overId}
                      activeId={activeId}
                      onSelect={(entity) => ecs.selectEntity(entity)}
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
                <div
                  className="
                    flex items-center gap-1 min-h-5 px-2 py-1
                    text-xs cursor-pointer
                    opacity-50
                  "
                  style={{
                    color: 'var(--vscode-foreground, #cccccc)',
                    backgroundColor: 'var(--vscode-list-inactiveSelectionBackground, rgba(0, 0, 0, 0.15))',
                  }}
                >
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

