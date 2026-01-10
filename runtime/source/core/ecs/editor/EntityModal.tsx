import React, { useEffect, useState, useRef } from "react";
import type { Component, Entity } from "../ecs";
import { addDrawCallback, removeDrawCallback } from "../../gameloop";

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackIdRef = useRef<number | null>(null);

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
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);

    return () => {
      if (callbackIdRef.current !== null) {
        removeDrawCallback(callbackIdRef.current);
        callbackIdRef.current = null;
      }
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, entity, ecsContext, isFocused, onClose]);

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

  if (!isOpen || !entity) return null;

  return (
    <div
      style={{
        backgroundColor: "rgba(128, 128, 128, 0.3)",
        borderRadius: "2px",
        border: "none",
        display: "flex",
        flexDirection: "column",
        fontFamily:
          "var(--vscode-font-family, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif)",
        minWidth: "400px",
        maxWidth: "600px",
        maxHeight: "500px",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
      }}
    >
      <div
        style={{
          padding: "0.25rem 0.5rem",
          fontSize: "0.75rem",
          fontWeight: "normal",
          border: "none",
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
            backgroundColor: "transparent",
            border: "none",
            cursor: "pointer",
            padding: "0.25rem",
            width: "20px",
            height: "20px",
            borderRadius: "2px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--vscode-foreground, #cccccc)",
            transition: "background-color 0.1s ease-out",
            backgroundColor: isCloseHovered
              ? "var(--vscode-button-hoverBackground, rgba(255, 255, 255, 0.1))"
              : "transparent",
          }}
          onClick={onClose}
          onMouseEnter={() => setIsCloseHovered(true)}
          onMouseLeave={() => setIsCloseHovered(false)}
        >
          <span className="codicon codicon-close" style={{ fontSize: "0.75rem" }} />
        </button>
      </div>
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: 0,
          backgroundColor: "transparent",
          borderRadius: "0 0 2px 2px",
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
            fontSize: "0.75rem",
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
            minHeight: "300px",
          }}
        />
      </div>
    </div>
  );
}
