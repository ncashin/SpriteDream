import React, { useEffect, useState, useRef, useMemo } from "react";
import type { Component, Entity } from "../ecs";
import { addDrawCallback, removeDrawCallback } from "../../gameloop";
import { componentRegistry } from "../component";
import { SearchInput } from "./SearchInput";

interface EntityModalProps {
  isOpen: boolean;
  entity: Entity | null;
  ecsContext: {
    ecs: {
      getEntity: (entity: Entity) => Record<string, Component>;
      addComponent: (entity: Entity, component: Component) => void;
      removeComponent: (entity: Entity, component: Component) => void;
    };
  } | null;
  onClose: () => void;
}

export function EntityModal({
  isOpen,
  entity,
  ecsContext,
  onClose,
}: EntityModalProps) {
  const [entityData, setEntityData] = useState<string>("");
  const [isValid, setIsValid] = useState(true);
  const [isFocused, setIsFocused] = useState(false);
  const [isCloseHovered, setIsCloseHovered] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showAddComponent, setShowAddComponent] = useState(false);
  const [componentSearchQuery, setComponentSearchQuery] = useState<string>("");
  const [isAddButtonHovered, setIsAddButtonHovered] = useState(false);
  const [isAddButtonPressed, setIsAddButtonPressed] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackIdRef = useRef<number | null>(null);
  const addComponentDropdownRef = useRef<HTMLDivElement>(null);

  // Handle search - scroll to and highlight matches
  useEffect(() => {
    if (!searchQuery.trim() || !textareaRef.current || isFocused) return;

    const textarea = textareaRef.current;
    const text = textarea.value;
    const query = searchQuery.toLowerCase();
    const searchIndex = text.toLowerCase().indexOf(query);

    if (searchIndex !== -1) {
      // Calculate line number
      const textBeforeMatch = text.substring(0, searchIndex);
      const lines = textBeforeMatch.split("\n");
      const lineNumber = lines.length - 1;

      // Scroll to the match
      const lineHeight =
        parseFloat(getComputedStyle(textarea).lineHeight) ||
        1.5 * parseFloat(getComputedStyle(textarea).fontSize);
      const scrollTop = lineNumber * lineHeight - textarea.clientHeight / 2;
      textarea.scrollTop = Math.max(0, scrollTop);

      // Select the match (but don't focus, so user can keep typing in search)
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

  useEffect(() => {
    if (!isOpen || !entity || !ecsContext) {
      if (callbackIdRef.current !== null) {
        removeDrawCallback(callbackIdRef.current);
        callbackIdRef.current = null;
      }
      return;
    }

    const updateEntityData = () => {
      if (!entity || !ecsContext || isFocused) return;

      try {
        const data = ecsContext.ecs.getEntity(entity);
        const entityJson = JSON.stringify(data, null, 2);
        setEntityData(entityJson);
        setIsValid(true);
      } catch (error) {
        setEntityData(`Error displaying entity data: ${error}`);
        setIsValid(false);
      }
    };

    // Update immediately
    updateEntityData();

    // Register draw callback to update every frame (runs regardless of editorEnabled state)
    const callbackId = addDrawCallback(() => {
      updateEntityData();
    });
    callbackIdRef.current = callbackId;

    // Handle Escape key
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showAddComponent) {
          setShowAddComponent(false);
        } else {
          onClose();
        }
      }
    };

    // Handle clicks outside add component dropdown
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
      if (callbackIdRef.current !== null) {
        removeDrawCallback(callbackIdRef.current);
        callbackIdRef.current = null;
      }
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, entity, ecsContext, isFocused, onClose, showAddComponent]);

  useEffect(() => {
    if (!isOpen || !entity || !ecsContext) return;

    try {
      const data = ecsContext.ecs.getEntity(entity);
      const entityJson = JSON.stringify(data, null, 2);
      setEntityData(entityJson);
      setIsValid(true);
    } catch (error) {
      setEntityData(`Error displaying entity data: ${error}`);
      setIsValid(false);
    }
  }, [isOpen, entity, ecsContext]);

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
        if (
          typeof parsedData === "object" &&
          parsedData !== null &&
          !Array.isArray(parsedData)
        ) {
          let valid = true;
          for (const [componentType, component] of Object.entries(parsedData)) {
            if (
              typeof component !== "object" ||
              component === null ||
              Array.isArray(component)
            ) {
              valid = false;
              break;
            }
            if (!component.type) {
              (component as Component).type = componentType;
            }
          }
          if (valid) {
            // Update entity data
            const currentData = ecsContext.ecs.getEntity(entity);

            // Remove components that are no longer in the new data
            for (const componentType of Object.keys(currentData)) {
              if (!parsedData[componentType]) {
                const componentToRemove = currentData[componentType];
                if (componentToRemove) {
                  ecsContext.ecs.removeComponent(entity, componentToRemove);
                }
              }
            }

            // Add or update components
            for (const [componentType, component] of Object.entries(
              parsedData
            )) {
              const componentWithType = {
                ...component,
                type: component.type || componentType,
              } as Component;
              ecsContext.ecs.addComponent(entity, componentWithType);
            }

            setIsValid(true);
          } else {
            setIsValid(false);
          }
        } else {
          setIsValid(false);
        }
      } catch (error) {
        setIsValid(false);
      }
    }, 500);
  };

  const handleAddComponent = (componentType: string) => {
    if (!entity || !ecsContext) return;

    const componentDef = componentRegistry[componentType];
    if (!componentDef) return;

    const newComponent = JSON.parse(
      JSON.stringify(componentDef.defaultComponent)
    ); // Deep clone
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
        border: "none",
        display: "flex",
        flexDirection: "column",
        fontFamily:
          "var(--vscode-font-family, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif)",
        minWidth: "300px",
        maxWidth: "500px",
        maxHeight: "500px",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
      }}
    >
      <div
        style={{
          padding: "0.25rem 0.25rem 0.25rem 0.5rem",
          fontSize: "0.75rem",
          fontWeight: "normal",
          border: "none",
          borderBottom:
            "1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.2))",
          backgroundColor: "transparent",
          color: "var(--vscode-button-foreground, rgba(255, 255, 255, 0.9))",
          fontFamily:
            "var(--vscode-font-family, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif)",
          outline: "none",
          boxSizing: "border-box",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "space-between",
          minHeight: "20px",
          lineHeight: "1.4em",
          width: "100%",
          userSelect: "none",
          borderRadius: "2px 2px 0 0",
        }}
      >
        <span style={{ fontSize: "0.75rem", fontWeight: "normal" }}>
          {entity}
        </span>
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
            color: "var(--vscode-button-foreground, rgba(255, 255, 255, 0.9))",
            transition: "background-color 0.1s ease-out",
            backgroundColor: isCloseHovered
              ? "var(--vscode-button-hoverBackground, rgba(255, 255, 255, 0.1))"
              : "transparent",
            marginLeft: "0.25rem",
          }}
          onClick={onClose}
          onMouseEnter={() => setIsCloseHovered(true)}
          onMouseLeave={() => setIsCloseHovered(false)}
        >
          <span
            className="codicon codicon-close"
            style={{ fontSize: "0.75rem" }}
          />
        </button>
      </div>

      {/* Toolbar with search and add component */}
      <div
        style={{
          padding: "0.25rem 0.25rem",
          borderBottom:
            "1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.2))",
          display: "flex",
          flexDirection: "row",
          gap: "0.5rem",
          alignItems: "center",
          backgroundColor: "rgba(0, 0, 0, 0.1)",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <SearchInput
            placeholder="Search JSON..."
            value={searchQuery}
            onChange={setSearchQuery}
            onKeyDown={(e) => {
              // Allow Cmd+A / Ctrl+A to select all
              if ((e.metaKey || e.ctrlKey) && e.key === "a") {
                e.preventDefault();
                e.currentTarget.select();
              }
            }}
          />
        </div>
        <div
          style={{ position: "relative", flexShrink: 0 }}
          ref={addComponentDropdownRef}
        >
          <button
            onClick={() => setShowAddComponent(!showAddComponent)}
            style={{
              padding: "0.125rem 0.75rem",
              fontSize: "0.75rem",
              fontWeight: "normal",
              backgroundColor: isAddButtonPressed
                ? "rgba(128, 128, 128, 0.4)"
                : isAddButtonHovered || showAddComponent
                ? "rgba(128, 128, 128, 0.35)"
                : "rgba(128, 128, 128, 0.3)",
              border: "none",
              borderRadius: "2px",
              cursor: "pointer",
              color:
                "var(--vscode-button-foreground, rgba(255, 255, 255, 0.9))",
              display: "inline-flex",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.25rem",
              fontFamily:
                "var(--vscode-font-family, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif)",
              transition: "background-color 0.1s ease-out",
              whiteSpace: "nowrap",
              minHeight: "20px",
              lineHeight: "1.4em",
              outline: "none",
              boxSizing: "border-box",
            }}
            onMouseEnter={() => setIsAddButtonHovered(true)}
            onMouseLeave={() => {
              setIsAddButtonHovered(false);
              setIsAddButtonPressed(false);
            }}
            onMouseDown={() => setIsAddButtonPressed(true)}
            onMouseUp={() => setIsAddButtonPressed(false)}
            onFocus={(e) => {
              e.currentTarget.style.outline =
                "1px solid var(--vscode-focusBorder, #007acc)";
              e.currentTarget.style.outlineOffset = "-1px";
            }}
            onBlur={(e) => {
              e.currentTarget.style.outline = "none";
            }}
          >
            <span
              className="codicon codicon-add"
              style={{ fontSize: "0.75rem" }}
            />
            <span>Add Component</span>
          </button>
          {showAddComponent && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                right: 0,
                marginTop: "0.25rem",
                backgroundColor: "rgb(60, 60, 60)",
                borderRadius: "4px",
                border: "none",
                minWidth: "200px",
                maxWidth: "300px",
                maxHeight: "300px",
                display: "flex",
                flexDirection: "column",
                zIndex: 10001,
                fontFamily:
                  "var(--vscode-font-family, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif)",
              }}
            >
              <div
                style={{
                  padding: "0.25rem 0.5rem",
                  borderBottom:
                    "1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.2))",
                }}
              >
                <SearchInput
                  placeholder="Search Components..."
                  value={componentSearchQuery}
                  onChange={setComponentSearchQuery}
                  onKeyDown={(e) => {
                    // Allow Cmd+A / Ctrl+A to select all
                    if ((e.metaKey || e.ctrlKey) && e.key === "a") {
                      e.preventDefault();
                      e.currentTarget.select();
                    }
                  }}
                  autoFocus
                />
              </div>
              <div
                style={{
                  overflow: "auto",
                  maxHeight: "250px",
                  padding: 0,
                  backgroundColor: "rgba(0, 0, 0, 0.1)",
                  borderRadius: "0 0 2px 2px",
                }}
              >
                {availableComponents.length === 0 ? (
                  <div
                    style={{
                      padding: "0.25rem 0.5rem",
                      minHeight: "20px",
                      lineHeight: "1.4em",
                      color:
                        "var(--vscode-descriptionForeground, rgba(255, 255, 255, 0.6))",
                      fontSize: "0.75rem",
                      textAlign: "center",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {componentSearchQuery
                      ? "No components found"
                      : "No available components"}
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
                        color: "var(--vscode-foreground, #cccccc)",
                        fontSize: "0.75rem",
                        fontFamily:
                          "var(--vscode-font-family, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif)",
                        transition: "background-color 0.1s ease-out",
                        minHeight: "20px",
                        lineHeight: "1.4em",
                        boxSizing: "border-box",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-start",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor =
                          "var(--vscode-list-hoverBackground, rgba(255, 255, 255, 0.1))";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "transparent";
                      }}
                    >
                      <div style={{ fontWeight: "normal" }}>
                        {def.displayName || type}
                      </div>
                      {def.description && (
                        <div
                          style={{
                            fontSize: "0.75rem",
                            color:
                              "var(--vscode-descriptionForeground, rgba(255, 255, 255, 0.6))",
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

      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: 0,
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
            color: "var(--vscode-foreground, #cccccc)",
            fontSize: "0.8rem",
            fontFamily:
              "var(--vscode-editor-font-family, 'Consolas', 'Courier New', monospace)",
            lineHeight: "1.5",
            resize: "none",
            outline: "none",
            boxSizing: "border-box",
            whiteSpace: "pre",
            overflowWrap: "normal",
            overflowX: "auto",
            border: isValid
              ? "none"
              : "1px solid var(--vscode-inputValidation-errorBorder, #f48771)",
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
              backgroundColor:
                "var(--vscode-inputValidation-errorBackground, rgba(244, 135, 113, 0.2))",
              color: "var(--vscode-inputValidation-errorForeground, #f48771)",
              fontSize: "0.7rem",
              borderRadius: "2px",
              fontFamily:
                "var(--vscode-font-family, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif)",
            }}
          >
            Invalid JSON
          </div>
        )}
      </div>
    </div>
  );
}
