import { useState, useEffect, useRef } from 'react';
import type { Entity } from '../ecs/ecs';
import { addDrawCallback, removeDrawCallback } from '../gameloop';

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

function getAllEntities(ecsContext: EntityListPanelProps['ecsContext']): Entity[] {
  if (!ecsContext || !ecsContext.ecs) {
    return [];
  }

  const entitySet = new Set<Entity>();
  const componentPools = ecsContext.ecs.ecsInstance.componentPools;
  
  for (const componentPool of Object.values(componentPools)) {
    if (componentPool && typeof componentPool === 'object') {
      for (const entity of Object.keys(componentPool as Record<string, unknown>)) {
        entitySet.add(entity);
      }
    }
  }
  return Array.from(entitySet);
}

export function EntityListPanel({ ecsContext, onEntityClick }: EntityListPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [entities, setEntities] = useState<Entity[]>([]);
  const callbackIdRef = useRef<number | null>(null);

  // Update entities every frame via game loop
  useEffect(() => {
    const updateEntities = () => {
      const allEntities = getAllEntities(ecsContext);
      setEntities(allEntities);
    };

    // Initial update
    updateEntities();

    // Register draw callback to update every frame (runs regardless of editorEnabled state)
    const callbackId = addDrawCallback(() => {
      updateEntities();
    });
    callbackIdRef.current = callbackId;

    return () => {
      if (callbackIdRef.current !== null) {
        removeDrawCallback(callbackIdRef.current);
        callbackIdRef.current = null;
      }
    };
  }, [ecsContext]);

  return (
    <div className="w-full bg-transparent flex flex-col font-[var(--vscode-font-family,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif)]">
      <button
        className={`px-3 py-1 text-[0.8125rem] font-normal border-0 cursor-pointer bg-transparent text-[var(--vscode-button-foreground,rgba(255,255,255,0.9))] font-[var(--vscode-font-family,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif)] outline-none box-border inline-flex items-center justify-between min-h-[22px] leading-[1.4em] w-full select-none ${
          isExpanded ? 'border-b border-[var(--vscode-panel-border,rgba(128,128,128,0.2))]' : ''
        } hover:bg-[var(--vscode-button-hoverBackground,rgba(255,255,255,0.1))] active:bg-[var(--vscode-button-activeBackground,rgba(255,255,255,0.15))] focus:outline-none`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="text-[0.8125rem] font-normal">
          Show Entity List
        </span>
        <span
          className={`codicon text-[0.75rem] ${
            isExpanded ? 'codicon-chevron-down' : 'codicon-chevron-right'
          }`}
        />
      </button>
      {isExpanded && (
        <div className="overflow-auto p-0 bg-transparent border-b border-[var(--vscode-panel-border,rgba(128,128,128,0.2))] max-h-[50vh]">
          {entities.length === 0 ? (
            <div className="p-3 text-[var(--vscode-descriptionForeground,rgba(255,255,255,0.6))] text-[0.8125rem] text-center">
              No entities found
            </div>
          ) : (
            entities.map((entity) => (
              <div
                key={entity}
                className="px-3 py-1 w-full box-border cursor-pointer text-[var(--vscode-foreground,#cccccc)] text-[0.8125rem] font-[var(--vscode-font-family,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif)] hover:bg-[var(--vscode-list-hoverBackground,rgba(255,255,255,0.1))]"
                onClick={() => onEntityClick(entity)}
              >
                <span className="overflow-hidden text-ellipsis whitespace-nowrap">
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

