import { useEffect, useState, useRef, useMemo } from "react";
import type { Component, Entity } from "../../ecs/ecs";
import { useGameContext } from "../EditorContext";
import { addDrawCallback, removeDrawCallback } from "../../gameloop";
import { componentRegistry } from "../../ecs/component";
import { SearchInput } from "./SearchInput";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddComponent, setShowAddComponent] = useState(false);
  const [componentSearchQuery, setComponentSearchQuery] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addComponentDropdownRef = useRef<HTMLDivElement>(null);

  // Search highlight effect
  useEffect(() => {
    if (!searchQuery.trim() || !textareaRef.current || isFocused) return;

    const textarea = textareaRef.current;
    const text = textarea.value;
    const searchIndex = text.toLowerCase().indexOf(searchQuery.toLowerCase());

    if (searchIndex !== -1) {
      const textBeforeMatch = text.substring(0, searchIndex);
      const lines = textBeforeMatch.split("\n");
      const lineNumber = lines.length - 1;
      const lineHeight =
        parseFloat(getComputedStyle(textarea).lineHeight) ||
        1.5 * parseFloat(getComputedStyle(textarea).fontSize);
      const scrollTop = lineNumber * lineHeight - textarea.clientHeight / 2;
      textarea.scrollTop = Math.max(0, scrollTop);
      textarea.setSelectionRange(searchIndex, searchIndex + searchQuery.length);
    }
  }, [searchQuery, isFocused]);

  // Filter available components
  const availableComponents = useMemo(() => {
    if (!entity || !ecs) return [];

    const currentComponents = ecs.getEntity(entity);
    const query = componentSearchQuery.toLowerCase();

    return Object.entries(componentRegistry)
      .filter(([type, def]) => {
        const matchesQuery =
          type.toLowerCase().includes(query) ||
          def.displayName?.toLowerCase().includes(query) ||
          def.description?.toLowerCase().includes(query);
        const notAlreadyAdded = !currentComponents[type];
        return matchesQuery && notAlreadyAdded;
      })
      .map(([type, def]) => ({ type, def }));
  }, [entity, ecs, componentSearchQuery]);

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
        } else {
          onClose();
        }
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (
        showAddComponent &&
        addComponentDropdownRef.current &&
        !addComponentDropdownRef.current.contains(e.target as Node)
      ) {
        setShowAddComponent(false);
        setComponentSearchQuery("");
      }
    };

    document.addEventListener("keydown", handleEscape);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      removeDrawCallback(callbackId);
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, entity, ecs, isFocused, onClose, showAddComponent]);

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
    setShowAddComponent(false);
    setComponentSearchQuery("");
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
      <div className="flex gap-2 items-center p-1 border-b border-gray-500/20 bg-black/10">
        <div className="flex-1 min-w-0">
          <SearchInput
            placeholder="Search JSON..."
            value={searchQuery}
            onChange={setSearchQuery}
          />
        </div>
        <div className="relative flex-shrink-0" ref={addComponentDropdownRef}>
          <button
            onClick={() => setShowAddComponent(!showAddComponent)}
            className={`flex items-center gap-1 px-3 py-0.5 text-xs border-none rounded-sm cursor-pointer text-white/90 transition-colors duration-100 min-h-5 ${showAddComponent ? "bg-gray-500/35" : "bg-gray-500/30"
              } hover:bg-gray-500/35 active:bg-gray-500/40`}
          >
            <span className="codicon codicon-add" />
            <span>Add Component</span>
          </button>

          {/* Dropdown */}
          {showAddComponent && (
            <div className="absolute top-full right-0 mt-1 bg-[rgb(60,60,60)] rounded min-w-[200px] max-w-[300px] max-h-[300px] flex flex-col z-[10001]">
              <div className="p-1 px-2 border-b border-gray-500/20">
                <SearchInput
                  placeholder="Search Components..."
                  value={componentSearchQuery}
                  onChange={setComponentSearchQuery}
                  autoFocus
                />
              </div>
              <div className="overflow-auto max-h-[250px] bg-black/10 rounded-b-sm">
                {availableComponents.length === 0 ? (
                  <div className="flex items-center justify-center min-h-5 px-2 py-1 text-xs text-white/60 text-center">
                    {componentSearchQuery ? "No components found" : "No available components"}
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
            </div>
          )}
        </div>
      </div>

      {/* JSON Editor */}
      <div className="flex-1 overflow-auto bg-black/10 rounded-b-sm relative">
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

