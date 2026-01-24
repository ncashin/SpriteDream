import { useEffect, useState, useRef, useMemo } from "react";
import type { Component, Entity } from "../../ecs/ecs";
import { useGameContext, startUndoAction } from "../EditorContext";
import { addDrawCallback, removeDrawCallback } from "../../gameloop";
import { componentRegistry } from "../../ecs/component";
import { JSONTreeView } from "./JSONTreeView";
import { SearchInput } from "./SearchInput";
import { X, Plus, Minus, PencilSimple, Trash } from "@phosphor-icons/react";

interface EntityModalProps {
  isOpen: boolean;
  entity: Entity | null;
  onClose: () => void;
}

export function EntityModal({ isOpen, entity, onClose }: EntityModalProps) {
  const gameContext = useGameContext();
  const ecs = gameContext?.ecs as any;
  const [entityData, setEntityData] = useState("");
  const [showAddComponent, setShowAddComponent] = useState(false);
  const [showRemoveComponent, setShowRemoveComponent] = useState(false);
  const [addComponentSearch, setAddComponentSearch] = useState("");
  const [removeComponentSearch, setRemoveComponentSearch] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const addComponentDropdownRef = useRef<HTMLDivElement>(null);
  const addComponentButtonRef = useRef<HTMLButtonElement>(null);
  const removeComponentDropdownRef = useRef<HTMLDivElement>(null);
  const removeComponentButtonRef = useRef<HTMLButtonElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const undoDebounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasRecordedUndoRef = useRef(false);

  // Filter available components
  const availableComponents = useMemo(() => {
    if (!entity || !ecs) return [];

    const currentComponents = ecs.getEntity(entity);

    return Object.entries(componentRegistry)
      .filter(([type]) => {
        const notAlreadyAdded = !currentComponents[type];
        return notAlreadyAdded;
      })
      .map(([type, def]) => ({ type, def }))
      .filter(({ type, def }) => {
        if (!addComponentSearch) return true;
        const searchLower = addComponentSearch.toLowerCase();
        return (
          type.toLowerCase().includes(searchLower) ||
          (def.displayName || "").toLowerCase().includes(searchLower) ||
          (def.description || "").toLowerCase().includes(searchLower)
        );
      });
  }, [entity, ecs, addComponentSearch]);

  // Get current components on entity
  const currentComponents = useMemo(() => {
    if (!entity || !ecs) return [];

    const components = ecs.getEntity(entity);

    return Object.entries(components)
      .map(([type, component]) => ({
        type,
        component: component as Component,
        def: componentRegistry[type],
      }))
      .filter(({ type, def }) => {
        if (!removeComponentSearch) return true;
        const searchLower = removeComponentSearch.toLowerCase();
        return (
          type.toLowerCase().includes(searchLower) ||
          (def?.displayName || "").toLowerCase().includes(searchLower) ||
          (def?.description || "").toLowerCase().includes(searchLower)
        );
      });
  }, [entity, ecs, entityData, removeComponentSearch]);

  // Reset undo recording flag when entity changes
  useEffect(() => {
    hasRecordedUndoRef.current = false;
    if (undoDebounceTimeoutRef.current) {
      clearTimeout(undoDebounceTimeoutRef.current);
      undoDebounceTimeoutRef.current = null;
    }
  }, [entity]);

  // Sync entity data from ECS
  useEffect(() => {
    if (!isOpen || !entity || !ecs) return;

    const updateEntityData = () => {
      try {
        const data = ecs.getEntity(entity);
        // Ensure transform.parent field is always present (set to null if undefined)
        if (data.transform && typeof data.transform === 'object') {
          if (!('parent' in data.transform) || data.transform.parent === undefined) {
            data.transform.parent = null;
          }
        }
        setEntityData(JSON.stringify(data, null, 2));
      } catch (error) {
        setEntityData(`Error: ${error}`);
      }
    };

    updateEntityData();
    const callbackId = addDrawCallback(updateEntityData);

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showAddComponent) {
          setShowAddComponent(false);
          setAddComponentSearch("");
        } else if (showRemoveComponent) {
          setShowRemoveComponent(false);
          setRemoveComponentSearch("");
        } else if (isRenaming) {
          setIsRenaming(false);
          setRenameValue("");
        } else {
          onClose();
        }
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;

      if (showAddComponent) {
        const isClickInDropdown = addComponentDropdownRef.current?.contains(target);
        const isClickOnButton = addComponentButtonRef.current?.contains(target);
        if (!isClickInDropdown && !isClickOnButton) {
          setShowAddComponent(false);
          setAddComponentSearch("");
        }
      }

      if (showRemoveComponent) {
        const isClickInDropdown = removeComponentDropdownRef.current?.contains(target);
        const isClickOnButton = removeComponentButtonRef.current?.contains(target);
        if (!isClickInDropdown && !isClickOnButton) {
          setShowRemoveComponent(false);
          setRemoveComponentSearch("");
        }
      }
    };

    document.addEventListener("keydown", handleEscape);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      removeDrawCallback(callbackId);
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, entity, ecs, onClose, showAddComponent, showRemoveComponent, isRenaming]);

  // Focus rename input when renaming starts
  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenaming]);


  const handleAddComponent = (componentType: string) => {
    if (!entity || !ecs) return;

    const componentDef = componentRegistry[componentType];
    if (!componentDef) return;

    const newComponent = JSON.parse(JSON.stringify(componentDef.defaultComponent));
    ecs.addComponent(entity, newComponent);

    // Immediately update the entity data to reflect the new component
    try {
      const data = ecs.getEntity(entity);
      setEntityData(JSON.stringify(data, null, 2));
    } catch (error) {
      setEntityData(`Error: ${error}`);
    }

    setShowAddComponent(false);
    setAddComponentSearch("");
  };

  const handleRemoveComponent = (component: Component) => {
    if (!entity || !ecs) return;

    ecs.removeComponent(entity, component);

    // Immediately update the entity data to reflect the removed component
    try {
      const data = ecs.getEntity(entity);
      setEntityData(JSON.stringify(data, null, 2));
    } catch (error) {
      setEntityData(`Error: ${error}`);
    }

    setShowRemoveComponent(false);
    setRemoveComponentSearch("");
  };

  const handleStartRename = () => {
    if (!entity) return;
    setIsRenaming(true);
    setRenameValue(entity);
  };

  const handleRenameSubmit = (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!entity || !ecs || !isRenaming) return;

    const newName = renameValue.trim();
    if (newName && newName !== entity) {
      const success = ecs.renameEntity(entity, newName);
      if (success) {
        // Entity is already selected after rename, no need to call selectEntity
      }
    }

    setIsRenaming(false);
    setRenameValue("");
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setIsRenaming(false);
      setRenameValue("");
    } else if (e.key === "Enter") {
      handleRenameSubmit(e);
    }
  };

  const handleDeleteEntity = () => {
    if (!entity || !ecs) return;
    ecs.destroyEntity(entity);
    onClose();
  };

  const isValidJSON = useMemo(() => {
    try {
      JSON.parse(entityData);
      return true;
    } catch {
      return false;
    }
  }, [entityData]);

  const handleTreeViewChange = (updatedJson: string) => {
    if (!entity || !ecs) return;

    try {
      const parsedData = JSON.parse(updatedJson) as Record<string, Component>;
      if (typeof parsedData !== "object" || parsedData === null || Array.isArray(parsedData)) {
        return;
      }

      // Start undo action on first change (debounced to group rapid changes)
      if (!hasRecordedUndoRef.current) {
        startUndoAction();
        hasRecordedUndoRef.current = true;
      }

      // Clear any existing debounce timeout
      if (undoDebounceTimeoutRef.current) {
        clearTimeout(undoDebounceTimeoutRef.current);
      }

      const currentData = ecs.getEntity(entity);

      // Remove deleted components
      for (const componentType of Object.keys(currentData)) {
        if (!parsedData[componentType]) {
          ecs.removeComponent(entity, currentData[componentType]);
        }
      }

      // Update components - preserve existing structure
      for (const [componentType, updatedComponent] of Object.entries(parsedData)) {
        const existingComponent = currentData[componentType];

        if (existingComponent) {
          // Update existing component by merging properties
          // This preserves the component structure and only updates changed properties
          Object.assign(existingComponent, updatedComponent);
          // Ensure type is set
          if (!existingComponent.type) {
            existingComponent.type = componentType;
          }
        } else {
          // Add new component
          ecs.addComponent(entity, {
            ...updatedComponent,
            type: updatedComponent.type || componentType,
          } as Component);
        }
      }

      // Update local state to reflect the actual current state
      try {
        const data = ecs.getEntity(entity);
        setEntityData(JSON.stringify(data, null, 2));
      } catch (error) {
        // If we can't get updated data, use the provided JSON
        setEntityData(updatedJson);
      }

      // Reset the undo recording flag after a delay (allows multiple rapid changes to be grouped)
      undoDebounceTimeoutRef.current = setTimeout(() => {
        hasRecordedUndoRef.current = false;
      }, 1000);
    } catch (error) {
      console.error('Error updating entity from tree view:', error);
    }
  };

  if (!isOpen || !entity) return null;

  return (
    <div
      className="flex flex-col rounded-sm"
      style={{
        width: '20rem',
        height: '20rem',
        fontFamily: 'var(--vscode-font-family, system-ui, -apple-system, sans-serif)',
        backgroundColor: 'var(--vscode-panel-background, #3c3c3c)',
        boxShadow: 'var(--vscode-widget-shadow, 0 2px 8px rgba(0, 0, 0, 0.3))',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between min-h-5 px-1 py-1 text-xs border-b select-none rounded-t-sm"
        style={{
          color: 'var(--vscode-foreground, rgba(255, 255, 255, 0.9))',
          borderBottomColor: 'var(--vscode-panel-border, rgba(128, 128, 128, 0.2))',
        }}
      >
        {isRenaming ? (
          <form
            onSubmit={handleRenameSubmit}
            className="flex-1 min-w-0"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              ref={renameInputRef}
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={handleRenameKeyDown}
              onBlur={handleRenameSubmit}
              className="
                w-full p-0 text-xs bg-transparent text-[#cccccc]
                border-none outline-none overflow-hidden
                text-ellipsis whitespace-nowrap min-w-0
              "
              style={{
                color: 'var(--vscode-foreground, rgba(255, 255, 255, 0.9))',
              }}
            />
          </form>
        ) : (
          <>
            <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{entity}</span>
            <div className="flex items-center">
              <button
                className="flex items-center justify-center w-5 h-5 p-0.5 rounded-sm border-none cursor-pointer transition-colors duration-100 bg-transparent"
                style={{
                  color: 'var(--vscode-foreground, rgba(255, 255, 255, 0.9))',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground, rgba(255, 255, 255, 0.1))';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
                onClick={handleStartRename}
                title="Rename entity"
              >
                <PencilSimple size={14} weight="bold" />
              </button>
              <button
                className="flex items-center justify-center w-5 h-5 p-0.5 rounded-sm border-none cursor-pointer transition-colors duration-100 bg-transparent"
                style={{
                  color: 'var(--vscode-errorForeground, #f48771)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground, rgba(255, 255, 255, 0.1))';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
                onClick={handleDeleteEntity}
                title="Delete entity"
              >
                <Trash size={14} weight="bold" />
              </button>
              <button
                className="flex items-center justify-center w-5 h-5 p-0.5 rounded-sm border-none cursor-pointer transition-colors duration-100 bg-transparent"
                style={{
                  color: 'var(--vscode-foreground, rgba(255, 255, 255, 0.9))',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground, rgba(255, 255, 255, 0.1))';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
                onClick={onClose}
              >
                <X size={14} weight="bold" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Toolbar */}
      <div
        className="flex items-stretch border-b min-h-5"
        style={{
          borderBottomColor: 'var(--vscode-panel-border, rgba(128, 128, 128, 0.2))',
          backgroundColor: 'var(--vscode-list-inactiveSelectionBackground, rgba(0, 0, 0, 0.1))',
        }}
      >
        <div className="relative flex-1">
          <button
            ref={addComponentButtonRef}
            onClick={() => {
              setShowAddComponent(!showAddComponent);
              setShowRemoveComponent(false);
              if (!showAddComponent) {
                setAddComponentSearch("");
              }
            }}
            className="flex items-center justify-center gap-1 h-full w-full px-2 py-1 text-xs border-none cursor-pointer transition-colors duration-100 whitespace-nowrap"
            style={{
              color: 'var(--vscode-foreground, rgba(255, 255, 255, 0.9))',
              backgroundColor: showAddComponent ? 'transparent' : 'var(--vscode-panel-background, #3c3c3c)',
            }}
            onMouseEnter={(e) => {
              if (!showAddComponent) {
                e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground, rgba(255, 255, 255, 0.1))';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = showAddComponent ? 'transparent' : 'var(--vscode-panel-background, #3c3c3c)';
            }}
            onMouseDown={(e) => {
              if (!showAddComponent) {
                e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground, rgba(255, 255, 255, 0.15))';
              }
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.backgroundColor = showAddComponent ? 'transparent' : 'var(--vscode-list-hoverBackground, rgba(255, 255, 255, 0.1))';
            }}
          >
            <Plus size={10} weight="bold" />
            <span>Add Component</span>
          </button>
        </div>
        <div
          className="w-px self-stretch"
          style={{
            backgroundColor: 'var(--vscode-panel-border, rgba(128, 128, 128, 0.2))',
          }}
        />
        <div className="relative flex-1">
          <button
            ref={removeComponentButtonRef}
            onClick={() => {
              setShowRemoveComponent(!showRemoveComponent);
              setShowAddComponent(false);
              if (!showRemoveComponent) {
                setRemoveComponentSearch("");
              }
            }}
            className="flex items-center justify-center gap-1 h-full w-full px-2 py-1 text-xs border-none cursor-pointer transition-colors duration-100 whitespace-nowrap"
            style={{
              color: 'var(--vscode-foreground, rgba(255, 255, 255, 0.9))',
              backgroundColor: showRemoveComponent ? 'transparent' : 'var(--vscode-panel-background, #3c3c3c)',
            }}
            onMouseEnter={(e) => {
              if (!showRemoveComponent) {
                e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground, rgba(255, 255, 255, 0.1))';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = showRemoveComponent ? 'transparent' : 'var(--vscode-panel-background, #3c3c3c)';
            }}
            onMouseDown={(e) => {
              if (!showRemoveComponent) {
                e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground, rgba(255, 255, 255, 0.15))';
              }
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.backgroundColor = showRemoveComponent ? 'transparent' : 'var(--vscode-list-hoverBackground, rgba(255, 255, 255, 0.1))';
            }}
          >
            <Minus size={10} weight="bold" />
            <span>Remove Component</span>
          </button>
        </div>
      </div>

      {/* JSON Tree View */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Add Component List - Overlays tree view when open */}
        {showAddComponent && (
          <div
            ref={addComponentDropdownRef}
            className="absolute top-0 left-0 right-0 flex flex-col z-10 max-h-full overflow-hidden"
            style={{
              backgroundColor: 'var(--vscode-panel-background, #3c3c3c)',
              boxShadow: 'var(--vscode-widget-shadow, 0 2px 8px rgba(0, 0, 0, 0.3))',
            }}
          >
            <div className="w-full">
              <SearchInput
                placeholder="Search components..."
                value={addComponentSearch}
                onChange={setAddComponentSearch}
                autoFocus={true}
              />
            </div>
            <div className="flex-1 overflow-auto">
              {availableComponents.length === 0 ? (
                <div
                  className="flex items-center justify-center min-h-5 px-2 py-1 text-xs text-center"
                  style={{
                    color: 'var(--vscode-descriptionForeground, rgba(255, 255, 255, 0.6))',
                  }}
                >
                  {addComponentSearch ? 'No components match your search' : 'No available components'}
                </div>
              ) : (
                availableComponents.map(({ type, def }) => (
                  <button
                    key={type}
                    onClick={() => handleAddComponent(type)}
                    className="w-full px-2 py-1 text-left bg-transparent border-none cursor-pointer text-xs transition-colors duration-100 min-h-5 flex flex-col items-start"
                    style={{
                      color: 'var(--vscode-foreground, #cccccc)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground, rgba(255, 255, 255, 0.1))';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div>{def.displayName || type}</div>
                    {def.description && (
                      <div
                        className="text-xs mt-0.5"
                        style={{
                          color: 'var(--vscode-descriptionForeground, rgba(255, 255, 255, 0.6))',
                        }}
                      >
                        {def.description}
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
        {/* Remove Component List - Overlays tree view when open */}
        {showRemoveComponent && (
          <div
            ref={removeComponentDropdownRef}
            className="absolute top-0 left-0 right-0 flex flex-col z-10 max-h-full overflow-hidden"
            style={{
              backgroundColor: 'var(--vscode-panel-background, #3c3c3c)',
              boxShadow: 'var(--vscode-widget-shadow, 0 2px 8px rgba(0, 0, 0, 0.3))',
            }}
          >
            <div className="w-full">
              <SearchInput
                placeholder="Search components..."
                value={removeComponentSearch}
                onChange={setRemoveComponentSearch}
                autoFocus={true}
              />
            </div>
            <div className="flex-1 overflow-auto">
              {currentComponents.length === 0 ? (
                <div
                  className="flex items-center justify-center min-h-5 px-2 py-1 text-xs text-center"
                  style={{
                    color: 'var(--vscode-descriptionForeground, rgba(255, 255, 255, 0.6))',
                  }}
                >
                  {removeComponentSearch ? 'No components match your search' : 'No components to remove'}
                </div>
              ) : (
                currentComponents.map(({ type, component, def }) => (
                  <button
                    key={type}
                    onClick={() => handleRemoveComponent(component)}
                    className="w-full px-2 py-1 text-left bg-transparent border-none cursor-pointer text-xs transition-colors duration-100 min-h-5 flex flex-col items-start"
                    style={{
                      color: 'var(--vscode-foreground, #cccccc)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground, rgba(255, 255, 255, 0.1))';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div>{def?.displayName || type}</div>
                    {def?.description && (
                      <div
                        className="text-xs mt-0.5"
                        style={{
                          color: 'var(--vscode-descriptionForeground, rgba(255, 255, 255, 0.6))',
                        }}
                      >
                        {def.description}
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
        {isValidJSON && entityData ? (
          <JSONTreeView json={entityData} onChange={handleTreeViewChange} ecs={ecs?.ecsInstance} entity={entity} />
        ) : (
          <div
            className="flex-1 flex items-center justify-center"
            style={{
              color: 'var(--vscode-errorForeground, #f48771)',
              fontSize: 'var(--vscode-editor-font-size, 14px)'
            }}
          >
            {entityData ? 'Invalid JSON - cannot display tree view' : 'Loading...'}
          </div>
        )}
      </div>
    </div>
  );
}

