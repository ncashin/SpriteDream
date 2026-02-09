import { useState, useRef, useEffect, useMemo, createContext, useContext } from 'react';
import type { CSSProperties, RefObject, MouseEvent, KeyboardEvent, ReactNode } from 'react';
import { CaretRight, Plus, Trash } from '@phosphor-icons/react';
import type { ECSInstance, Entity } from '../../../../ecs/ecs';
import type { TreeNodeComponentProps, JSONValue } from '../types';
import { getPropertyInputType, parseInputValue } from '../utils';
import { TreeNodeValueEditor } from './TreeNodeValueEditor';
import { AddChildForm } from './AddChildForm';

type TreeContextValue = {
  expandedPaths: Set<string>;
  onToggleExpand: (path: string) => void;
  onNodeClick?: (path: string, value: JSONValue) => void;
  onValueChange?: (path: string, newValue: JSONValue) => void;
  onAddChild?: (path: string, key: string | null, value: JSONValue) => void;
  onRemoveNode?: (path: string) => void;
  onRenameKey?: (path: string, newKey: string) => void;
  ecs?: ECSInstance;
  entity?: Entity;
};

const TreeContext = createContext<TreeContextValue | null>(null);

export function TreeContextProvider({ value, children }: { value: TreeContextValue; children: ReactNode }) {
  return <TreeContext.Provider value={value}>{children}</TreeContext.Provider>;
}

function useTreeContext() {
  const context = useContext(TreeContext);
  if (!context) {
    throw new Error('TreeNodeComponent must be used within a TreeContextProvider');
  }
  return context;
}

type ChevronProps = {
  isExpanded: boolean;
};

function Chevron({ isExpanded }: ChevronProps) {
  return (
    <span
      className={`inline-flex h-3 w-3 items-start justify-start text-[var(--vscode-editor-foreground,#cccccc)] transition-transform duration-100 ${isExpanded ? 'rotate-90' : ''}`}
    >
      <CaretRight size={12} weight="bold" />
    </span>
  );
}

type KeyEditorProps = {
  nodeKey: string;
  isEditingKey: boolean;
  editKeyValue: string;
  keyInputRef: RefObject<HTMLInputElement>;
  onStartEditKey: (e: MouseEvent) => void;
  onEditKeyChange: (value: string) => void;
  onKeyDown: (e: KeyboardEvent) => void;
  onBlur: () => void;
  showColon?: boolean;
  isBold?: boolean;
};

function KeyEditor({
  nodeKey,
  isEditingKey,
  editKeyValue,
  keyInputRef,
  onStartEditKey,
  onEditKeyChange,
  onKeyDown,
  onBlur,
  showColon = false,
  isBold = false,
}: KeyEditorProps) {
  return (
    <span className="inline-block whitespace-nowrap text-[var(--vscode-editor-foreground,#cccccc)] text-inherit cursor-default">
      {nodeKey !== 'root' && (
        <>
          {isEditingKey ? (
            <input
              ref={keyInputRef}
              type="text"
              value={editKeyValue}
              size={Math.max(1, editKeyValue.length)}
              onChange={(e) => onEditKeyChange(e.target.value)}
              onKeyDown={onKeyDown}
              onBlur={onBlur}
              onClick={(e) => e.stopPropagation()}
              className="w-auto rounded-sm border border-[rgba(128,128,128,0.35)] bg-transparent px-1 py-[1px] font-inherit text-[var(--vscode-editor-foreground,#cccccc)] text-inherit"
            />
          ) : (
            <span
              className={`${isBold ? 'font-semibold' : 'font-normal'} cursor-default`}
              onClick={onStartEditKey}
            >
              {nodeKey}
            </span>
          )}
          {showColon && (
            <span className="mx-[2px] text-[var(--vscode-descriptionForeground,#808080)]">:</span>
          )}
        </>
      )}
    </span>
  );
}

type ActionButtonsProps = {
  canAddChild: boolean;
  canRemoveNode: boolean;
  onAddChild: (e: MouseEvent) => void;
  onRemoveNode: (e: MouseEvent) => void;
};

function ActionButtons({ canAddChild, canRemoveNode, onAddChild, onRemoveNode }: ActionButtonsProps) {
  if (!canAddChild && !canRemoveNode) return null;

  return (
    <div className="flex gap-1 opacity-0 pointer-events-none transition-opacity duration-100 group-hover:opacity-100 group-hover:pointer-events-auto">
      {canAddChild && (
        <button
          type="button"
          onClick={onAddChild}
          className="bg-transparent border-none cursor-pointer p-0 rounded-md flex items-center justify-center transition-colors duration-100 text-[var(--vscode-foreground,rgba(255,255,255,0.9))] hover:bg-[var(--vscode-list-hoverBackground,rgba(255,255,255,0.1))]"
          title="Add child"
        >
          <Plus size={12} weight="bold" />
        </button>
      )}
      {canRemoveNode && (
        <button
          type="button"
          onClick={onRemoveNode}
          className="bg-transparent border-none cursor-pointer p-0 rounded-md flex items-center justify-center transition-colors duration-100 text-[var(--vscode-errorForeground,#f48771)] hover:bg-[var(--vscode-list-hoverBackground,rgba(255,255,255,0.1))]"
          title="Remove node"
        >
          <Trash size={12} weight="bold" />
        </button>
      )}
    </div>
  );
}

type RemoveButtonProps = {
  onRemove: (e: MouseEvent) => void;
  className?: string;
};

function RemoveButton({ onRemove, className = '' }: RemoveButtonProps) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className={`bg-transparent border-none cursor-pointer p-0 rounded-md flex items-center justify-center transition-colors duration-100 text-[var(--vscode-errorForeground,#f48771)] hover:bg-[var(--vscode-list-hoverBackground,rgba(255,255,255,0.1))] ${className}`}
      title="Remove node"
    >
      <Trash size={12} weight="bold" />
    </button>
  );
}

export function TreeNodeComponent({
  node,
}: TreeNodeComponentProps) {
  const {
    expandedPaths,
    onToggleExpand,
    onNodeClick,
    onValueChange,
    onAddChild,
    onRemoveNode,
    onRenameKey,
    ecs,
    entity,
  } = useTreeContext();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [isAddingChild, setIsAddingChild] = useState(false);
  const [newChildKey, setNewChildKey] = useState('');
  const [newChildValue, setNewChildValue] = useState('');
  const [isEditingKey, setIsEditingKey] = useState(false);
  const [editKeyValue, setEditKeyValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const keyInputRef = useRef<HTMLInputElement>(null);
  const isExpanded = expandedPaths.has(node.path);
  const hasChildren = node.children && node.children.length > 0;
  const indent = node.level * 16;
  const isObjectOrArray = node.type === 'object' || node.type === 'array';
  const isTypeField = node.key === 'type';
  const isEditable = !isObjectOrArray && node.key !== 'root' && !isTypeField;
  const isArrayIndex = /^\d+$/.test(node.key);
  const isKeyEditable = node.key !== 'root' && !isTypeField && !isArrayIndex && !!onRenameKey;
  const canAddChild = isObjectOrArray && node.key !== 'root' && !!onAddChild;
  const canRemoveNode = node.key !== 'root' && !isTypeField && !!onRemoveNode;

  // Get custom input type for this property
  const customInputType = useMemo(() => {
    if (!isEditable) return null;
    return getPropertyInputType(node.path);
  }, [node.path, isEditable]);

  const handleRowClick = () => {
    if (isObjectOrArray && hasChildren) {
      onToggleExpand(node.path);
    } else if (!isObjectOrArray && !isEditing && isEditable) {
      // For dropdown, file, and color types, don't enter edit mode - they handle their own state
      if (customInputType?.type === 'dropdown' || customInputType?.type === 'file' || customInputType?.type === 'color' || customInputType?.type === 'bitmask') {
        // These components will handle their own opening
        return;
      }
      setIsEditing(true);
      setEditValue(String(node.value));
    }
    onNodeClick?.(node.path, node.value);
  };

  const handleStartEditKey = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isKeyEditable) return;
    setIsEditingKey(true);
    setEditKeyValue(node.key);
  };

  const handleKeyEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const nextKey = editKeyValue.trim();
      if (!nextKey || nextKey === 'type' || nextKey === node.key) {
        setIsEditingKey(false);
        return;
      }
      onRenameKey?.(node.path, nextKey);
      setIsEditingKey(false);
    } else if (e.key === 'Escape') {
      setIsEditingKey(false);
      setEditKeyValue(node.key);
    }
  };

  const handleKeyEditBlur = () => {
    if (!isEditingKey) return;
    const nextKey = editKeyValue.trim();
    if (!nextKey || nextKey === 'type' || nextKey === node.key) {
      setIsEditingKey(false);
      setEditKeyValue(node.key);
      return;
    }
    onRenameKey?.(node.path, nextKey);
    setIsEditingKey(false);
  };

  const handleStartAddChild = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsAddingChild(true);
    setNewChildKey('');
    setNewChildValue('');
  };

  const handleRemoveNode = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemoveNode?.(node.path);
  };

  const handleConfirmAddChild = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onAddChild) return;
    if (node.type === 'object') {
      const key = newChildKey.trim();
      if (!key || key === 'type') return;
      onAddChild(node.path, key, parseInputValue(newChildValue));
    }
    if (node.type === 'array') {
      onAddChild(node.path, null, parseInputValue(newChildValue));
    }
    setIsAddingChild(false);
    setNewChildKey('');
    setNewChildValue('');
  };

  const handleCancelAddChild = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsAddingChild(false);
  };

  const handleValueChange = (newValue: JSONValue) => {
    if (onValueChange) {
      onValueChange(node.path, newValue);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      let parsedValue: JSONValue;
      try {
        if (node.type === 'string') {
          parsedValue = editValue;
        } else if (node.type === 'number') {
          parsedValue = parseFloat(editValue);
          if (isNaN(parsedValue as number)) {
            return;
          }
        } else if (node.type === 'boolean') {
          parsedValue = editValue.toLowerCase() === 'true';
        } else {
          parsedValue = editValue === 'null' ? null : editValue;
        }
        handleValueChange(parsedValue);
      } catch {
        // Invalid value, don't update
      }
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditValue(String(node.value));
    }
  };

  const handleBlur = () => {
    if (isEditing) {
      let parsedValue: JSONValue;
      try {
        if (node.type === 'string') {
          parsedValue = editValue;
          handleValueChange(parsedValue);
        } else if (node.type === 'number') {
          parsedValue = parseFloat(editValue);
          if (!isNaN(parsedValue as number)) {
            handleValueChange(parsedValue);
          } else {
            // Invalid number, revert to original value
            setIsEditing(false);
            setEditValue(String(node.value));
          }
        } else if (node.type === 'boolean') {
          parsedValue = editValue.toLowerCase() === 'true';
          handleValueChange(parsedValue);
        } else {
          parsedValue = editValue === 'null' ? null : editValue;
          handleValueChange(parsedValue);
        }
      } catch {
        // On error, always exit editing mode
        setIsEditing(false);
        setEditValue(String(node.value));
      }
    }
  };

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    if (isEditingKey && keyInputRef.current) {
      keyInputRef.current.focus();
      keyInputRef.current.select();
    }
  }, [isEditingKey]);

  const rowClassName = `json-tree-row group grid min-h-[1.25rem] w-full box-border bg-transparent px-[5px] pl-2 transition-colors hover:bg-[var(--vscode-list-hoverBackground,rgba(255,255,255,0.05))] ${(isObjectOrArray && hasChildren) || (!isObjectOrArray && isEditable) ? 'cursor-pointer' : 'cursor-default'
    }`;
  const rowStyle = undefined;

  const childKeyColumn = useMemo(() => {
    if (!node.children || node.children.length === 0) return null;
    let max = 0;
    for (const child of node.children) {
      if (child.key && child.key !== 'root') {
        max = Math.max(max, child.key.length);
      }
    }
    return max > 0 ? max : null;
  }, [node.children]);

  const childStyle = childKeyColumn
    ? ({ '--json-tree-key-column': `${childKeyColumn}ch` } as CSSProperties)
    : undefined;

  if (isObjectOrArray) {
    return (
      <>
        <div
          className={rowClassName}
          style={rowStyle}
          onClick={handleRowClick}
        >
          <div className="flex items-center py-1 pr-1">
            {hasChildren && (
              <Chevron isExpanded={isExpanded} />
            )}
          </div>
          <div className="flex items-center px-1 py-1 text-left cursor-default">
            <KeyEditor
              nodeKey={node.key}
              isEditingKey={isEditingKey}
              editKeyValue={editKeyValue}
              keyInputRef={keyInputRef}
              onStartEditKey={handleStartEditKey}
              onEditKeyChange={setEditKeyValue}
              onKeyDown={handleKeyEditKeyDown}
              onBlur={handleKeyEditBlur}
              isBold={node.key !== 'root'}
            />
          </div>
          <div className="flex items-center justify-between px-1 py-1 pl-2">
            <div className="flex-1"></div>
            <ActionButtons
              canAddChild={canAddChild}
              canRemoveNode={canRemoveNode}
              onAddChild={handleStartAddChild}
              onRemoveNode={handleRemoveNode}
            />
          </div>
        </div>
        {isAddingChild && (
          <AddChildForm
            nodeType={node.type as 'object' | 'array'}
            indent={indent}
            newChildKey={newChildKey}
            newChildValue={newChildValue}
            onKeyChange={setNewChildKey}
            onValueChange={setNewChildValue}
            onConfirm={handleConfirmAddChild}
            onCancel={handleCancelAddChild}
          />
        )}
        {hasChildren && isExpanded && node.children && (
          <div className="w-full" style={childStyle}>
            {node.children.map((child) => (
              <TreeNodeComponent
                key={child.path}
                node={child}
              />
            ))}
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <div
        className={rowClassName}
        style={rowStyle}
        onClick={handleRowClick}
      >
        <div className="flex items-center py-1 pr-1">
          {hasChildren && (
            <Chevron isExpanded={isExpanded} />
          )}
        </div>
        <div className="flex items-center px-1 py-1 text-left cursor-default">
          <KeyEditor
            nodeKey={node.key}
            isEditingKey={isEditingKey}
            editKeyValue={editKeyValue}
            keyInputRef={keyInputRef}
            onStartEditKey={handleStartEditKey}
            onEditKeyChange={setEditKeyValue}
            onKeyDown={handleKeyEditKeyDown}
            onBlur={handleKeyEditBlur}
            showColon={true}
          />
        </div>
        <div className="relative flex items-center justify-between px-1 py-1 pl-2">
          <TreeNodeValueEditor
            node={node}
            isEditing={isEditing}
            editValue={editValue}
            onEditValueChange={setEditValue}
            onValueChange={handleValueChange}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            inputRef={inputRef}
            ecs={ecs}
            entity={entity}
          />
          {canRemoveNode && (
            <RemoveButton
              onRemove={handleRemoveNode}
              className="opacity-0 pointer-events-none transition-opacity group-hover:opacity-100 group-hover:pointer-events-auto"
            />
          )}
        </div>
      </div>
      {hasChildren && isExpanded && node.children && (
        <div className="w-full" style={childStyle}>
          {node.children.map((child) => (
            <TreeNodeComponent
              key={child.path}
              node={child}
            />
          ))}
        </div>
      )}
    </>
  );
}

