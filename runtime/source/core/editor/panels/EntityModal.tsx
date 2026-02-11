import { useState, useRef, useMemo, useEffect } from "react";
import { flushSync } from "react-dom";
import type { Component, Entity } from "../../ecs/ecs";
import type { curryECSInstance } from "../../ecs/ecs";
import { useGameContext, startUndoAction } from "../useGameContext.tsx";
import { useEntityData } from "../useECS.tsx";
import { runImmediateEditorSync } from "../../gameloop";
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
  const ecs = (gameContext?.ecs as ReturnType<typeof curryECSInstance> | undefined);
  const entityData = useEntityData(entity);
  const [entityDataJson, setEntityDataJson] = useState("");
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
  const lastEntityRef = useRef<Entity | null>(null);

  // Update entityDataJson when entityData changes
  useEffect(() => {
    if (isOpen && entity && entityData) {
      try {
        const data = { ...entityData };
        if (data.transform && typeof data.transform === 'object') {
          if (!('parent' in data.transform) || data.transform.parent === undefined) {
            data.transform.parent = null;
          }
        }
        setEntityDataJson(JSON.stringify(data, null, 2));
      } catch (error) {
        setEntityDataJson(`Error: ${error}`);
      }
    } else if (!isOpen) {
      setEntityDataJson("");
    }
  }, [isOpen, entity, entityData]);

  // Reset undo tracking when entity changes
  useEffect(() => {
    if (entity !== lastEntityRef.current) {
      hasRecordedUndoRef.current = false;
      if (undoDebounceTimeoutRef.current) {
        clearTimeout(undoDebounceTimeoutRef.current);
        undoDebounceTimeoutRef.current = null;
      }
      lastEntityRef.current = entity;
    }
  }, [entity]);

  const availableComponents = useMemo(() => {
    if (!entity || !entityData) return [];

    return Object.entries(componentRegistry)
      .filter(([type]) => {
        const notAlreadyAdded = !entityData[type];
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
  }, [entity, entityData, addComponentSearch]);

  const currentComponents = useMemo(() => {
    if (!entity || !entityData) return [];

    return Object.entries(entityData)
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
  }, [entity, entityData, removeComponentSearch]);


  const handleAddComponent = (componentType: string) => {
    if (!entity || !ecs) return;

    const componentDef = componentRegistry[componentType];
    if (!componentDef) return;

    const newComponent = JSON.parse(JSON.stringify(componentDef.defaultComponent));
    const entityProxy = ecs.getEntity(entity);
    entityProxy[newComponent.type] = newComponent;

    flushSync(() => runImmediateEditorSync());
    setShowAddComponent(false);
    setAddComponentSearch("");
  };

  const handleRemoveComponent = (component: Component) => {
    if (!entity || !ecs) return;

    const entityProxy = ecs.getEntity(entity);
    delete entityProxy[component.type];

    flushSync(() => runImmediateEditorSync());
    setShowRemoveComponent(false);
    setRemoveComponentSearch("");
  };

  const handleStartRename = () => {
    if (!entity) return;
    setIsRenaming(true);
    setRenameValue(entity);
    setTimeout(() => {
      if (renameInputRef.current) {
        renameInputRef.current.focus();
        renameInputRef.current.select();
      }
    }, 0);
  };

  const handleRenameSubmit = (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!entity || !ecs || !isRenaming) return;

    const newName = renameValue.trim();
    if (newName && newName !== entity) {
      ecs.renameEntity(entity, newName);
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
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

  const handleClickOutside = (e: React.MouseEvent) => {
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

  const isValidJSON = useMemo(() => {
    try {
      JSON.parse(entityDataJson);
      return true;
    } catch {
      return false;
    }
  }, [entityDataJson]);

  const handleTreeViewChange = (updatedJson: string) => {
    if (!entity || !ecs) return;

    try {
      const parsedData = JSON.parse(updatedJson) as Record<string, Component>;
      if (typeof parsedData !== "object" || parsedData === null || Array.isArray(parsedData)) {
        return;
      }

      if (!hasRecordedUndoRef.current) {
        startUndoAction();
        hasRecordedUndoRef.current = true;
      }

      if (undoDebounceTimeoutRef.current) {
        clearTimeout(undoDebounceTimeoutRef.current);
      }

      const currentData = entityData;
      const entityProxy = ecs.getEntity(entity);

      for (const componentType of Object.keys(currentData)) {
        if (!parsedData[componentType]) {
          delete entityProxy[componentType];
        }
      }

      for (const [componentType, updatedComponent] of Object.entries(parsedData)) {
        const existingComponent = currentData[componentType];

        if (existingComponent) {
          for (const key of Object.keys(existingComponent)) {
            if (!(key in updatedComponent)) {
              delete (existingComponent as Record<string, unknown>)[key];
            }
          }
          Object.assign(existingComponent, updatedComponent);
          if (!existingComponent.type) {
            existingComponent.type = componentType;
          }
        } else {
          entityProxy[updatedComponent.type || componentType] = {
            ...updatedComponent,
            type: updatedComponent.type || componentType,
          } as Component;
        }
      }

      setEntityDataJson(updatedJson);
      flushSync(() => runImmediateEditorSync());

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
      className="flex flex-col rounded-sm w-80 h-80 relative z-[2000] pointer-events-auto bg-[var(--vscode-panel-background,#3c3c3c)] shadow-[var(--vscode-widget-shadow,0_2px_8px_rgba(0,0,0,0.3))] font-[var(--vscode-font-family,system-ui,-apple-system,sans-serif)]"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => {
        e.stopPropagation();
        handleClickOutside(e);
      }}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div
        className="flex items-center justify-between min-h-5 pl-2 pr-1 py-1 text-xs border-b select-none rounded-t-sm text-[var(--vscode-foreground,rgba(255,255,255,0.9))] border-b-[var(--vscode-panel-border,rgba(128,128,128,0.2))]"
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
              className="w-full p-0 text-xs bg-transparent border-none outline-none overflow-hidden text-ellipsis whitespace-nowrap min-w-0 text-[var(--vscode-foreground,rgba(255,255,255,0.9))]"
            />
          </form>
        ) : (
          <>
            <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{entity}</span>
            <div className="flex items-center">
              <button
                className="flex items-center justify-center w-5 h-5 p-0.5 rounded-sm border-none cursor-pointer transition-colors duration-100 bg-transparent hover:bg-[var(--vscode-list-hoverBackground,rgba(255,255,255,0.1))] text-[var(--vscode-foreground,rgba(255,255,255,0.9))]"
                onClick={handleStartRename}
                title="Rename entity"
              >
                <PencilSimple size={14} weight="bold" />
              </button>
              <button
                className="flex items-center justify-center w-5 h-5 p-0.5 rounded-sm border-none cursor-pointer transition-colors duration-100 bg-transparent hover:bg-[var(--vscode-list-hoverBackground,rgba(255,255,255,0.1))] text-[var(--vscode-errorForeground,#f48771)]"
                onClick={handleDeleteEntity}
                title="Delete entity"
              >
                <Trash size={14} weight="bold" />
              </button>
              <button
                className="flex items-center justify-center w-5 h-5 p-0.5 rounded-sm border-none cursor-pointer transition-colors duration-100 bg-transparent hover:bg-[var(--vscode-list-hoverBackground,rgba(255,255,255,0.1))] text-[var(--vscode-foreground,rgba(255,255,255,0.9))]"
                onClick={onClose}
              >
                <X size={14} weight="bold" />
              </button>
            </div>
          </>
        )}
      </div>

      <div
        className="flex items-stretch border-b min-h-5 border-b-[var(--vscode-panel-border,rgba(128,128,128,0.2))] bg-[var(--vscode-list-inactiveSelectionBackground,rgba(0,0,0,0.1))]"
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
            className={`flex items-center justify-center gap-1 h-full w-full px-2 py-1 text-xs border-none cursor-pointer transition-colors duration-100 whitespace-nowrap text-[var(--vscode-foreground,rgba(255,255,255,0.9))] ${showAddComponent
              ? 'bg-transparent'
              : 'bg-[var(--vscode-panel-background,#3c3c3c)] hover:bg-[var(--vscode-list-hoverBackground,rgba(255,255,255,0.1))] active:bg-[var(--vscode-list-hoverBackground,rgba(255,255,255,0.15))]'
              }`}
          >
            <Plus size={10} weight="bold" />
            <span>Add Component</span>
          </button>
        </div>
        <div
          className="w-px self-stretch bg-[var(--vscode-panel-border,rgba(128,128,128,0.2))]"
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
            className={`flex items-center justify-center gap-1 h-full w-full px-2 py-1 text-xs border-none cursor-pointer transition-colors duration-100 whitespace-nowrap text-[var(--vscode-foreground,rgba(255,255,255,0.9))] ${showRemoveComponent
              ? 'bg-transparent'
              : 'bg-[var(--vscode-panel-background,#3c3c3c)] hover:bg-[var(--vscode-list-hoverBackground,rgba(255,255,255,0.1))] active:bg-[var(--vscode-list-hoverBackground,rgba(255,255,255,0.15))]'
              }`}
          >
            <Minus size={10} weight="bold" />
            <span>Remove Component</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden relative min-h-0">
        {showAddComponent && (
          <div
            ref={addComponentDropdownRef}
            className="absolute top-0 left-0 right-0 flex flex-col z-10 max-h-full overflow-hidden bg-[var(--vscode-panel-background,#3c3c3c)] shadow-[var(--vscode-widget-shadow,0_2px_8px_rgba(0,0,0,0.3))]"
          >
            <div className="w-full">
              <SearchInput
                placeholder="Search components..."
                value={addComponentSearch}
                onChange={setAddComponentSearch}
                autoFocus={true}
              />
            </div>
            <div className="editor-scrollbar flex-1 overflow-auto">
              {availableComponents.length === 0 ? (
                <div
                  className="flex items-center justify-center min-h-5 px-2 py-1 text-xs text-center text-[var(--vscode-descriptionForeground,rgba(255,255,255,0.6))]"
                >
                  {addComponentSearch ? 'No components match your search' : 'No available components'}
                </div>
              ) : (
                availableComponents.map(({ type, def }) => (
                  <button
                    key={type}
                    onClick={() => handleAddComponent(type)}
                    className="w-full px-2 py-1 text-left bg-transparent border-none cursor-pointer text-xs transition-colors duration-100 min-h-5 flex flex-col items-start hover:bg-[var(--vscode-list-hoverBackground,rgba(255,255,255,0.1))] text-[var(--vscode-foreground,#cccccc)]"
                  >
                    <div>{def.displayName || type}</div>
                    {def.description && (
                      <div
                        className="text-xs mt-0.5 text-[var(--vscode-descriptionForeground,rgba(255,255,255,0.6))]"
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
        {showRemoveComponent && (
          <div
            ref={removeComponentDropdownRef}
            className="absolute top-0 left-0 right-0 flex flex-col z-10 max-h-full overflow-hidden bg-[var(--vscode-panel-background,#3c3c3c)] shadow-[var(--vscode-widget-shadow,0_2px_8px_rgba(0,0,0,0.3))]"
          >
            <div className="w-full">
              <SearchInput
                placeholder="Search components..."
                value={removeComponentSearch}
                onChange={setRemoveComponentSearch}
                autoFocus={true}
              />
            </div>
            <div className="editor-scrollbar flex-1 overflow-auto">
              {currentComponents.length === 0 ? (
                <div
                  className="flex items-center justify-center min-h-5 px-2 py-1 text-xs text-center text-[var(--vscode-descriptionForeground,rgba(255,255,255,0.6))]"
                >
                  {removeComponentSearch ? 'No components match your search' : 'No components to remove'}
                </div>
              ) : (
                currentComponents.map(({ type, component, def }) => (
                  <button
                    key={type}
                    onClick={() => handleRemoveComponent(component)}
                    className="w-full px-2 py-1 text-left bg-transparent border-none cursor-pointer text-xs transition-colors duration-100 min-h-5 flex flex-col items-start hover:bg-[var(--vscode-list-hoverBackground,rgba(255,255,255,0.1))] text-[var(--vscode-foreground,#cccccc)]"
                  >
                    <div>{def?.displayName || type}</div>
                    {def?.description && (
                      <div
                        className="text-xs mt-0.5 text-[var(--vscode-descriptionForeground,rgba(255,255,255,0.6))]"
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
        {isValidJSON && entityDataJson ? (
          <JSONTreeView json={entityDataJson} onChange={handleTreeViewChange} ecs={ecs?.ecsInstance} entity={entity} />
        ) : (
          <div
            className="flex-1 flex items-center justify-center text-[var(--vscode-errorForeground,#f48771)] text-[var(--vscode-editor-font-size,14px)]"
          >
            {entityDataJson ? 'Invalid JSON - cannot display tree view' : 'Loading...'}
          </div>
        )}
      </div>
    </div>
  );
}

