import { useState, useEffect, useRef } from "react";
import type { Entity } from "../ecs";
import { addDrawCallback, removeDrawCallback } from "../../gameloop";

interface EntityListPanelProps {
  ecsContext: {
    ecs: {
      ecsInstance: {
        componentPools: Record<string, Record<string, unknown>>;
      };
      getEntity: (entity: Entity) => Record<string, unknown>;
    };
  } | null;
  onEntityClick: (entity: Entity) => void;
}

function getAllEntities(
  ecsContext: EntityListPanelProps["ecsContext"]
): Entity[] {
  if (!ecsContext || !ecsContext.ecs) {
    return [];
  }

  const entitySet = new Set<Entity>();
  const componentPools = ecsContext.ecs.ecsInstance.componentPools;

  for (const componentPool of Object.values(componentPools)) {
    if (componentPool && typeof componentPool === "object") {
      for (const entity of Object.keys(
        componentPool as Record<string, unknown>
      )) {
        entitySet.add(entity);
      }
    }
  }
  return Array.from(entitySet);
}

// Preserve expanded state across HMR
let preservedIsExpanded = true;

export function EntityListPanel({
  ecsContext,
  onEntityClick,
}: EntityListPanelProps) {
  // Restore preserved state on mount
  const [isExpanded, setIsExpanded] = useState(preservedIsExpanded);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [isHovered, setIsHovered] = useState(false);
  const [hoveredEntity, setHoveredEntity] = useState<Entity | null>(null);
  const callbackIdRef = useRef<number | null>(null);

  // Update preserved state when it changes
  useEffect(() => {
    preservedIsExpanded = isExpanded;
  }, [isExpanded]);

  // Update entities every frame via game loop, but only when they actually change
  useEffect(() => {
    const updateEntities = () => {
      const allEntities = getAllEntities(ecsContext);
      // Only update state if entities actually changed to prevent unnecessary re-renders
      setEntities((prevEntities) => {
        if (
          prevEntities.length !== allEntities.length ||
          !prevEntities.every((entity, index) => entity === allEntities[index])
        ) {
          return allEntities;
        }
        return prevEntities;
      });
    };

    // Initial update
    updateEntities();

    // Also do an immediate update after a short delay to catch entities that might
    // be added right after initialization
    const timeoutId = setTimeout(() => {
      updateEntities();
    }, 100);

    // Register draw callback to update every frame (runs regardless of editorEnabled state)
    const callbackId = addDrawCallback(() => {
      updateEntities();
    });
    callbackIdRef.current = callbackId;

    return () => {
      clearTimeout(timeoutId);
      if (callbackIdRef.current !== null) {
        removeDrawCallback(callbackIdRef.current);
        callbackIdRef.current = null;
      }
    };
  }, [ecsContext]);

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
        minWidth: "200px",
        maxWidth: "300px",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
      }}
    >
      <button
        style={{
          padding: "0.25rem 0.25rem 0.25rem 0.5rem",
          fontSize: "0.75rem",
          fontWeight: "normal",
          border: "none",
          borderBottom: isExpanded
            ? "1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.2))"
            : "none",
          cursor: "pointer",
          backgroundColor: isHovered
            ? "rgba(128, 128, 128, 0.35)"
            : "transparent",
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
          transition: "background-color 0.1s ease-out",
          borderRadius: isExpanded ? "2px 2px 0 0" : "2px",
        }}
        onClick={() => setIsExpanded(!isExpanded)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onFocus={(e) => {
          e.currentTarget.style.outline =
            "1px solid var(--vscode-focusBorder, #007acc)";
          e.currentTarget.style.outlineOffset = "-1px";
        }}
        onBlur={(e) => {
          e.currentTarget.style.outline = "none";
        }}
      >
        <span style={{ fontSize: "0.75rem", fontWeight: "normal" }}>
          Entities ({entities.length})
        </span>
        <span
          className={`codicon ${
            isExpanded ? "codicon-chevron-down" : "codicon-chevron-right"
          }`}
          style={{
            fontSize: "0.75rem",
            marginLeft: "0.25rem",
          }}
        />
      </button>
      {isExpanded && (
        <div
          style={{
            overflow: "auto",
            padding: 0,
            backgroundColor: "rgba(0, 0, 0, 0.1)",
            maxHeight: "400px",
            borderRadius: "0 0 2px 2px",
          }}
        >
          {entities.length === 0 ? (
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
              No entities
            </div>
          ) : (
            entities.map((entity) => (
              <div
                key={entity}
                style={{
                  padding: "0.25rem 0.5rem",
                  minHeight: "20px",
                  lineHeight: "1.4em",
                  width: "100%",
                  boxSizing: "border-box",
                  cursor: "pointer",
                  color: "var(--vscode-foreground, #cccccc)",
                  fontSize: "0.75rem",
                  fontFamily:
                    "var(--vscode-font-family, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif)",
                  backgroundColor:
                    hoveredEntity === entity
                      ? "var(--vscode-list-hoverBackground, rgba(255, 255, 255, 0.1))"
                      : "transparent",
                  transition: "background-color 0.1s ease-out",
                  display: "flex",
                  alignItems: "center",
                }}
                onClick={() => onEntityClick(entity)}
                onMouseEnter={() => setHoveredEntity(entity)}
                onMouseLeave={() => setHoveredEntity(null)}
              >
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    display: "block",
                  }}
                >
                  {entity}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
