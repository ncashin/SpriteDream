import { useEffect, useState, useRef, useMemo } from "react";
import type { Component, Entity } from "../../ecs/ecs";
import { useGameContext } from "../EditorContext";
import { addDrawCallback, removeDrawCallback } from "../../gameloop";
import { componentRegistry } from "../../ecs/component";

interface EntityModalProps {
  isOpen: boolean;
  entity: Entity | null;
  onClose: () => void;
}

export function EntityModal({ isOpen, entity, onClose }: EntityModalProps) {
  const gameContext = useGameContext();
  const ecs = gameContext?.ecs as any;
  const [entityData, setEntityData] = useState("");
  const [isValid, setIsValid] = useState(true);
  const [isFocused, setIsFocused] = useState(false);
  const [showAddComponent, setShowAddComponent] = useState(false);
  const [showRemoveComponent, setShowRemoveComponent] = useState(false);
  const addComponentDropdownRef = useRef<HTMLDivElement>(null);
  const addComponentButtonRef = useRef<HTMLButtonElement>(null);
  const removeComponentDropdownRef = useRef<HTMLDivElement>(null);
  const removeComponentButtonRef = useRef<HTMLButtonElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    return Object.entries(components).map(([type, component]) => ({
      type,
      component: component as Component,
      def: componentRegistry[type],
    }));
  }, [entity, ecs, entityData]);

  // Sync entity data from ECS
  useEffect(() => {
    if (!isOpen || !entity || !ecs) return;

    const updateEntityData = () => {
      if (isFocused) return;
      try {
        const data = ecs.getEntity(entity);
        setEntityData(JSON.stringify(data, null, 2));
        setIsValid(true);
      } catch (error) {
        setEntityData(`Error: ${error}`);
        setIsValid(false);
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
  }, [isOpen, entity, ecs, isFocused, onClose, showAddComponent, showRemoveComponent]);

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setEntityData(value);

    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    updateTimeoutRef.current = setTimeout(() => {
      if (!entity || !ecs) return;

      try {
        const parsedData = JSON.parse(value) as Record<string, Component>;
        if (typeof parsedData !== "object" || parsedData === null || Array.isArray(parsedData)) {
          setIsValid(false);
          return;
        }

        let valid = true;
        for (const [componentType, component] of Object.entries(parsedData)) {
          if (typeof component !== "object" || component === null || Array.isArray(component)) {
            valid = false;
            break;
          }
          if (!component.type) {
            (component as Component).type = componentType;
          }
        }

        if (valid) {
          const currentData = ecs.getEntity(entity);

          // Remove deleted components
          for (const componentType of Object.keys(currentData)) {
            if (!parsedData[componentType]) {
              ecs.removeComponent(entity, currentData[componentType]);
            }
          }

          // Add/update components
          for (const [componentType, component] of Object.entries(parsedData)) {
            ecs.addComponent(entity, {
              ...component,
              type: component.type || componentType,
            } as Component);
          }

          setIsValid(true);
        } else {
          setIsValid(false);
        }
      } catch {
        setIsValid(false);
      }
    }, 500);
  };

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
      setIsValid(true);
    } catch (error) {
      setEntityData(`Error: ${error}`);
      setIsValid(false);
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
      setIsValid(true);
    } catch (error) {
      setEntityData(`Error: ${error}`);
      setIsValid(false);
    }

    setShowRemoveComponent(false);
  };

  if (!isOpen || !entity) return null;

  return (
    <div
      className="flex flex-col bg-[rgb(60,60,60)] rounded-sm min-w-[300px] max-w-[500px] max-h-[500px] shadow-[0_2px_8px_rgba(0,0,0,0.3)]"
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
      <div className="flex items-center border-b border-gray-500/20 bg-black/10">
        <div className="relative flex-shrink-0">
          <button
            ref={addComponentButtonRef}
            onClick={() => {
              setShowAddComponent(!showAddComponent);
              setShowRemoveComponent(false);
            }}
            className={`flex items-center gap-1 px-3 py-1 text-xs border-none cursor-pointer text-white/90 transition-colors duration-100 min-h-5 ${showAddComponent ? "bg-gray-500/35" : "bg-transparent"
              } hover:bg-gray-500/35 active:bg-gray-500/40`}
          >
            <span className="codicon codicon-add" />
            <span>Add Component</span>
          </button>
        </div>
        <div className="h-4 w-px bg-gray-500/20" />
        <div className="relative flex-shrink-0">
          <button
            ref={removeComponentButtonRef}
            onClick={() => {
              setShowRemoveComponent(!showRemoveComponent);
              setShowAddComponent(false);
            }}
            className={`flex items-center gap-1 px-3 py-1 text-xs border-none cursor-pointer text-white/90 transition-colors duration-100 min-h-5 ${showRemoveComponent ? "bg-gray-500/35" : "bg-transparent"
              } hover:bg-gray-500/35 active:bg-gray-500/40`}
          >
            <span className="codicon codicon-remove" />
            <span>Remove Component</span>
          </button>
        </div>
      </div>

      {/* JSON Editor */}
      <div className="flex-1 overflow-auto bg-black/10 rounded-b-sm relative">
        {/* Add Component List - Overlays textarea when open */}
        {showAddComponent && (
          <div
            ref={addComponentDropdownRef}
            className="absolute top-0 left-0 right-0 max-h-[250px] overflow-auto bg-[rgb(60,60,60)] border-b border-gray-500/20 z-10 shadow-[0_2px_8px_rgba(0,0,0,0.3)]"
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
        {/* Remove Component List - Overlays textarea when open */}
        {showRemoveComponent && (
          <div
            ref={removeComponentDropdownRef}
            className="absolute top-0 left-0 right-0 max-h-[250px] overflow-auto bg-[rgb(60,60,60)] border-b border-gray-500/20 z-10 shadow-[0_2px_8px_rgba(0,0,0,0.3)]"
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
        <textarea
          ref={textareaRef}
          value={entityData}
          onChange={handleTextareaChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className={`w-full h-full p-3 bg-transparent text-[#cccccc] text-sm font-mono leading-normal resize-none outline-none box-border whitespace-pre overflow-wrap-normal overflow-x-auto min-h-[250px] ${isValid ? "border-none" : "border border-[#f48771]"
            }`}
          style={{ tabSize: 2 }}
        />
        {!isValid && (
          <div className="absolute bottom-2 right-2 px-2 py-1 bg-[rgba(244,135,113,0.2)] text-[#f48771] text-xs rounded-sm">
            Invalid JSON
          </div>
        )}
      </div>
    </div>
  );
}

