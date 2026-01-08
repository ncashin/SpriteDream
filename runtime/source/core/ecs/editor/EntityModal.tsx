import React, { useEffect, useState, useRef } from 'react';
import type { Component, Entity } from '../ecs';
import { addDrawCallback, removeDrawCallback } from '../../gameloop';

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

export function EntityModal({ isOpen, entity, ecsContext, onClose }: EntityModalProps) {
  const [entityData, setEntityData] = useState<string>('');
  const [isValid, setIsValid] = useState(true);
  const [isFocused, setIsFocused] = useState(false);
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
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);

    return () => {
      if (callbackIdRef.current !== null) {
        removeDrawCallback(callbackIdRef.current);
        callbackIdRef.current = null;
      }
      document.removeEventListener('keydown', handleEscape);
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
        if (typeof parsedData === 'object' && parsedData !== null && !Array.isArray(parsedData)) {
          let valid = true;
          for (const [componentType, component] of Object.entries(parsedData)) {
            if (typeof component !== 'object' || component === null || Array.isArray(component)) {
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
            for (const [componentType, component] of Object.entries(parsedData)) {
              const componentWithType = { ...component, type: component.type || componentType } as Component;
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
    <div className="w-full flex-1 flex flex-col bg-transparent font-[var(--vscode-font-family,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif)]">
      <div className="pl-3 pr-2 pt-1.5 pb-1.5 text-[0.8125rem] font-normal rounded-sm border-0 bg-transparent text-[var(--vscode-button-foreground,rgba(255,255,255,0.9))] font-[var(--vscode-font-family,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif)] outline-none box-border inline-flex items-center justify-between min-h-[22px] leading-[1.4em] w-full select-none border-b border-[var(--vscode-panel-border,rgba(128,128,128,0.2))]">
        <span className="text-[0.8125rem] font-normal">
          {entity}
        </span>
        <button
          className="bg-transparent border-0 cursor-pointer p-1 w-6 h-6 rounded hover:bg-[var(--vscode-button-hoverBackground,rgba(255,255,255,0.1))] active:bg-[var(--vscode-button-activeBackground,rgba(255,255,255,0.15))] flex items-center justify-center text-[var(--vscode-foreground,#cccccc)]"
          onClick={onClose}
        >
          <span className="codicon codicon-close text-[0.75rem]" />
        </button>
      </div>
      <div className="flex-1 overflow-auto p-0 bg-transparent border-b border-[var(--vscode-panel-border,rgba(128,128,128,0.2))]">
        <textarea
          ref={textareaRef}
          value={entityData}
          onChange={handleTextareaChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className={`w-full h-full p-3 bg-transparent text-[var(--vscode-foreground,#cccccc)] text-[0.8125rem] font-[var(--vscode-editor-font-family,'Consolas','Courier New',monospace)] leading-[1.5] resize-none outline-none box-border whitespace-pre overflow-wrap-normal overflow-x-auto ${
            isValid 
              ? 'border-0' 
              : 'border border-[var(--vscode-inputValidation-errorBorder,#f48771)]'
          }`}
        />
      </div>
    </div>
  );
}















