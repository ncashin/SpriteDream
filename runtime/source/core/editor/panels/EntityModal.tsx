import { useEffect, useState, useRef, useMemo } from "react";
import type { Component, Entity } from "../../ecs/ecs";
import { useGameContext } from "../EditorContext";
import { addDrawCallback, removeDrawCallback } from "../../gameloop";
import { componentRegistry } from "../../ecs/component";
import { JSONTreeView } from "./JSONTreeView";

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
  const addComponentDropdownRef = useRef<HTMLDivElement>(null);
  const addComponentButtonRef = useRef<HTMLButtonElement>(null);
  const removeComponentDropdownRef = useRef<HTMLDivElement>(null);
  const removeComponentButtonRef = useRef<HTMLButtonElement>(null);

  // Filter available components
  const availableComponents = useMemo(() => {
    if (!entity || !ecs) return [];

    const currentComponents = ecs.getEntity(entity);

    return Object.entries(componentRegistry)
      .filter(([type]) => {
        const notAlreadyAdded = !currentComponents[type];
        return notAlreadyAdded;
      })
      .map(([type, def]) => ({ type, def }));
  }, [entity, ecs]);

  // Get current components on entity
  const currentComponents = useMemo(() => {
    if (!entity || !ecs) return [];

    const components = ecs.getEntity(entity);

    return Object.entries(components)
      .map(([type, component]) => ({
        type,
        component: component as Component,
        def: componentRegistry[type],
      }));
  }, [entity, ecs, entityData]);

  // Sync entity data from ECS
  useEffect(() => {
    if (!isOpen || !entity || !ecs) return;

    const updateEntityData = () => {
      try {
        const data = ecs.getEntity(entity);
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
        } else if (showRemoveComponent) {
          setShowRemoveComponent(false);
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
        }
      }

      if (showRemoveComponent) {
        const isClickInDropdown = removeComponentDropdownRef.current?.contains(target);
        const isClickOnButton = removeComponentButtonRef.current?.contains(target);
        if (!isClickInDropdown && !isClickOnButton) {
          setShowRemoveComponent(false);
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
  }, [isOpen, entity, ecs, onClose, showAddComponent, showRemoveComponent]);


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
    } catch (error) {
      console.error('Error updating entity from tree view:', error);
    }
  };

  if (!isOpen || !entity) return null;

  return (
    <div
      className="flex flex-col bg-[rgb(60,60,60)] rounded-sm min-w-[400px] max-w-[600px] max-h-[600px] shadow-[0_2px_8px_rgba(0,0,0,0.3)]"
      style={{
        fontFamily: 'var(--vscode-font-family, system-ui, -apple-system, sans-serif)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between min-h-5 px-1 pl-2 py-1 text-xs border-b border-gray-500/20 text-white/90 select-none rounded-t-sm">
        <span>{entity}</span>
        <button
          className="flex items-center justify-center w-4 h-4 p-0.5 rounded-sm border-none cursor-pointer text-white/90 transition-colors duration-100 ml-1 bg-transparent hover:bg-white/10"
          onClick={onClose}
        >
          <span className="codicon codicon-close" />
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-stretch border-b border-gray-500/20 bg-black/10 min-h-5">
        <div className="relative flex-shrink-0">
          <button
            ref={addComponentButtonRef}
            onClick={() => {
              setShowAddComponent(!showAddComponent);
              setShowRemoveComponent(false);
            }}
            className={`flex items-center justify-center gap-1 w-auto h-full px-2 py-1 text-xs border-none cursor-pointer text-white/90 transition-colors duration-100 whitespace-nowrap ${showAddComponent ? "bg-transparent" : "bg-gray-500/35"
              } hover:bg-gray-600/50 active:bg-gray-700/70`}
          >
            <span className="codicon codicon-add text-[10px]" />
            <span>Add Component</span>
          </button>
        </div>
        <div className="w-px bg-gray-500/20 self-stretch" />
        <div className="relative flex-shrink-0">
          <button
            ref={removeComponentButtonRef}
            onClick={() => {
              setShowRemoveComponent(!showRemoveComponent);
              setShowAddComponent(false);
            }}
            className={`flex items-center justify-center gap-1 w-auto h-full px-2 py-1 text-xs border-none cursor-pointer text-white/90 transition-colors duration-100 whitespace-nowrap ${showRemoveComponent ? "bg-transparent" : "bg-gray-500/35"
              } hover:bg-gray-600/50 active:bg-gray-700/70`}
          >
            <span className="codicon codicon-remove text-[10px]" />
            <span>Remove Component</span>
          </button>
        </div>
        <div className="flex-1" />
      </div>

      {/* JSON Tree View */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Add Component List - Overlays tree view when open */}
        {showAddComponent && (
          <div
            ref={addComponentDropdownRef}
            className="absolute top-0 left-0 right-0 flex flex-col bg-[rgb(60,60,60)] z-10 shadow-[0_2px_8px_rgba(0,0,0,0.3)] max-h-full overflow-auto"
          >
            {availableComponents.length === 0 ? (
              <div className="flex items-center justify-center min-h-5 px-2 py-1 text-xs text-white/60 text-center">
                No available components
              </div>
            ) : (
              availableComponents.map(({ type, def }) => (
                <button
                  key={type}
                  onClick={() => handleAddComponent(type)}
                  className="w-full px-2 py-1 text-left bg-transparent border-none cursor-pointer text-[#cccccc] text-xs transition-colors duration-100 min-h-5 flex flex-col items-start hover:bg-white/10"
                >
                  <div>{def.displayName || type}</div>
                  {def.description && (
                    <div className="text-xs text-white/60 mt-0.5">
                      {def.description}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        )}
        {/* Remove Component List - Overlays tree view when open */}
        {showRemoveComponent && (
          <div
            ref={removeComponentDropdownRef}
            className="absolute top-0 left-0 right-0 flex flex-col bg-[rgb(60,60,60)] z-10 shadow-[0_2px_8px_rgba(0,0,0,0.3)] max-h-full overflow-auto"
          >
            {currentComponents.length === 0 ? (
              <div className="flex items-center justify-center min-h-5 px-2 py-1 text-xs text-white/60 text-center">
                No components to remove
              </div>
            ) : (
              currentComponents.map(({ type, component, def }) => (
                <button
                  key={type}
                  onClick={() => handleRemoveComponent(component)}
                  className="w-full px-2 py-1 text-left bg-transparent border-none cursor-pointer text-[#cccccc] text-xs transition-colors duration-100 min-h-5 flex flex-col items-start hover:bg-white/10"
                >
                  <div>{def?.displayName || type}</div>
                  {def?.description && (
                    <div className="text-xs text-white/60 mt-0.5">
                      {def.description}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        )}
        {isValidJSON && entityData ? (
          <JSONTreeView json={entityData} onChange={handleTreeViewChange} />
        ) : (
          <div className="flex-1 flex items-center justify-center" style={{ color: '#f48771', fontSize: '13px' }}>
            {entityData ? 'Invalid JSON - cannot display tree view' : 'Loading...'}
          </div>
        )}
      </div>
    </div>
  );
}

