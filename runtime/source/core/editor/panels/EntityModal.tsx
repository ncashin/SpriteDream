import { useEffect, useState, useRef, useMemo } from "react";
import type { Component, Entity } from "../../ecs/ecs";
import { useEditorContext } from "../EditorContext";
import { addDrawCallback, removeDrawCallback } from "../../gameloop";
import { componentRegistry } from "../../ecs/component";
import { SearchInput } from "./SearchInput";

interface EntityModalProps {
  isOpen: boolean;
  entity: Entity | null;
  onClose: () => void;
}

export function EntityModal({ isOpen, entity, onClose }: EntityModalProps) {
  const ecsContext = useEditorContext();
  const [entityData, setEntityData] = useState("");
  const [isValid, setIsValid] = useState(true);
  const [isFocused, setIsFocused] = useState(false);
  const [isCloseHovered, setIsCloseHovered] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddComponent, setShowAddComponent] = useState(false);
  const [componentSearchQuery, setComponentSearchQuery] = useState("");
  const [isAddButtonHovered, setIsAddButtonHovered] = useState(false);
  const [isAddButtonPressed, setIsAddButtonPressed] = useState(false);
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
    if (!entity || !ecsContext) return [];

    const currentComponents = ecsContext.ecs.getEntity(entity);
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
  }, [entity, ecsContext, componentSearchQuery]);

  // Sync entity data from ECS
  useEffect(() => {
    if (!isOpen || !entity || !ecsContext) return;

    const updateEntityData = () => {
      if (isFocused) return;
      try {
        const data = ecsContext.ecs.getEntity(entity);
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
  }, [isOpen, entity, ecsContext, isFocused, onClose, showAddComponent]);

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setEntityData(value);

    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    updateTimeoutRef.current = setTimeout(() => {
      if (!entity || !ecsContext) return;

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
          const currentData = ecsContext.ecs.getEntity(entity);

          // Remove deleted components
          for (const componentType of Object.keys(currentData)) {
            if (!parsedData[componentType]) {
              ecsContext.ecs.removeComponent(entity, currentData[componentType]);
            }
          }

          // Add/update components
          for (const [componentType, component] of Object.entries(parsedData)) {
            ecsContext.ecs.addComponent(entity, {
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
    if (!entity || !ecsContext) return;

    const componentDef = componentRegistry[componentType];
    if (!componentDef) return;

    const newComponent = JSON.parse(JSON.stringify(componentDef.defaultComponent));
    ecsContext.ecs.addComponent(entity, newComponent);
    setShowAddComponent(false);
    setComponentSearchQuery("");
  };

  if (!isOpen || !entity) return null;

  return (
    <div
      style={{
        backgroundColor: "rgb(60, 60, 60)",
        borderRadius: "2px",
        display: "flex",
        flexDirection: "column",
        fontFamily: "var(--vscode-font-family, system-ui, -apple-system, sans-serif)",
        minWidth: "300px",
        maxWidth: "500px",
        maxHeight: "500px",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "0.25rem 0.25rem 0.25rem 0.5rem",
          fontSize: "0.75rem",
          borderBottom: "1px solid rgba(128, 128, 128, 0.2)",
          color: "rgba(255, 255, 255, 0.9)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          minHeight: "20px",
          userSelect: "none",
          borderRadius: "2px 2px 0 0",
        }}
      >
        <span>{entity}</span>
        <button
          style={{
            border: "none",
            cursor: "pointer",
            padding: "0.125rem",
            width: "16px",
            height: "16px",
            borderRadius: "2px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "rgba(255, 255, 255, 0.9)",
            transition: "background-color 0.1s",
            backgroundColor: isCloseHovered ? "rgba(255, 255, 255, 0.1)" : "transparent",
            marginLeft: "0.25rem",
          }}
          onClick={onClose}
          onMouseEnter={() => setIsCloseHovered(true)}
          onMouseLeave={() => setIsCloseHovered(false)}
        >
          <span className="codicon codicon-close" style={{ fontSize: "0.75rem" }} />
        </button>
      </div>

      {/* Toolbar */}
      <div
        style={{
          padding: "0.25rem",
          borderBottom: "1px solid rgba(128, 128, 128, 0.2)",
          display: "flex",
          gap: "0.5rem",
          alignItems: "center",
          backgroundColor: "rgba(0, 0, 0, 0.1)",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <SearchInput
            placeholder="Search JSON..."
            value={searchQuery}
            onChange={setSearchQuery}
          />
        </div>
        <div style={{ position: "relative", flexShrink: 0 }} ref={addComponentDropdownRef}>
          <button
            onClick={() => setShowAddComponent(!showAddComponent)}
            style={{
              padding: "0.125rem 0.75rem",
              fontSize: "0.75rem",
              backgroundColor: isAddButtonPressed
                ? "rgba(128, 128, 128, 0.4)"
                : isAddButtonHovered || showAddComponent
                ? "rgba(128, 128, 128, 0.35)"
                : "rgba(128, 128, 128, 0.3)",
              border: "none",
              borderRadius: "2px",
              cursor: "pointer",
              color: "rgba(255, 255, 255, 0.9)",
              display: "flex",
              alignItems: "center",
              gap: "0.25rem",
              transition: "background-color 0.1s",
              minHeight: "20px",
            }}
            onMouseEnter={() => setIsAddButtonHovered(true)}
            onMouseLeave={() => {
              setIsAddButtonHovered(false);
              setIsAddButtonPressed(false);
            }}
            onMouseDown={() => setIsAddButtonPressed(true)}
            onMouseUp={() => setIsAddButtonPressed(false)}
          >
            <span className="codicon codicon-add" style={{ fontSize: "0.75rem" }} />
            <span>Add Component</span>
          </button>

          {/* Dropdown */}
          {showAddComponent && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                right: 0,
                marginTop: "0.25rem",
                backgroundColor: "rgb(60, 60, 60)",
                borderRadius: "4px",
                minWidth: "200px",
                maxWidth: "300px",
                maxHeight: "300px",
                display: "flex",
                flexDirection: "column",
                zIndex: 10001,
              }}
            >
              <div
                style={{
                  padding: "0.25rem 0.5rem",
                  borderBottom: "1px solid rgba(128, 128, 128, 0.2)",
                }}
              >
                <SearchInput
                  placeholder="Search Components..."
                  value={componentSearchQuery}
                  onChange={setComponentSearchQuery}
                  autoFocus
                />
              </div>
              <div
                style={{
                  overflow: "auto",
                  maxHeight: "250px",
                  backgroundColor: "rgba(0, 0, 0, 0.1)",
                  borderRadius: "0 0 2px 2px",
                }}
              >
                {availableComponents.length === 0 ? (
                  <div
                    style={{
                      padding: "0.25rem 0.5rem",
                      minHeight: "20px",
                      color: "rgba(255, 255, 255, 0.6)",
                      fontSize: "0.75rem",
                      textAlign: "center",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {componentSearchQuery ? "No components found" : "No available components"}
                  </div>
                ) : (
                  availableComponents.map(({ type, def }) => (
                    <button
                      key={type}
                      onClick={() => handleAddComponent(type)}
                      style={{
                        width: "100%",
                        padding: "0.25rem 0.5rem",
                        textAlign: "left",
                        backgroundColor: "transparent",
                        border: "none",
                        cursor: "pointer",
                        color: "#cccccc",
                        fontSize: "0.75rem",
                        transition: "background-color 0.1s",
                        minHeight: "20px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-start",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "transparent";
                      }}
                    >
                      <div>{def.displayName || type}</div>
                      {def.description && (
                        <div
                          style={{
                            fontSize: "0.75rem",
                            color: "rgba(255, 255, 255, 0.6)",
                            marginTop: "0.125rem",
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
        </div>
      </div>

      {/* JSON Editor */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          backgroundColor: "rgba(0, 0, 0, 0.1)",
          borderRadius: "0 0 2px 2px",
          position: "relative",
        }}
      >
        <textarea
          ref={textareaRef}
          value={entityData}
          onChange={handleTextareaChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={{
            width: "100%",
            height: "100%",
            padding: "0.75rem",
            backgroundColor: "transparent",
            color: "#cccccc",
            fontSize: "0.8rem",
            fontFamily: "'Consolas', 'Courier New', monospace",
            lineHeight: "1.5",
            resize: "none",
            outline: "none",
            boxSizing: "border-box",
            whiteSpace: "pre",
            overflowWrap: "normal",
            overflowX: "auto",
            border: isValid ? "none" : "1px solid #f48771",
            minHeight: "250px",
            tabSize: 2,
          }}
        />
        {!isValid && (
          <div
            style={{
              position: "absolute",
              bottom: "0.5rem",
              right: "0.5rem",
              padding: "0.25rem 0.5rem",
              backgroundColor: "rgba(244, 135, 113, 0.2)",
              color: "#f48771",
              fontSize: "0.7rem",
              borderRadius: "2px",
            }}
          >
            Invalid JSON
          </div>
        )}
      </div>
    </div>
  );
}

