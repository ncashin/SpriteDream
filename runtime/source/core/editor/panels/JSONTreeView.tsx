import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Plus, Trash, X, Check, CaretDown } from '@phosphor-icons/react';
import { componentRegistry, type PropertyInputType } from '../../ecs/component';
import { SearchableDropdown } from './SearchableDropdown';
import { FileInput } from './FileInput';
import { ColorInput } from './ColorInput';
import type { ECSInstance, Entity } from '../../ecs/ecs';
import { setParent, getChildren } from '../../transform';

interface JSONTreeViewProps {
  json: string;
  onNodeSelect?: (path: string, value: any) => void;
  onChange?: (json: string) => void;
  className?: string;
  ecs?: ECSInstance;
  entity?: Entity;
}

type JSONValue = string | number | boolean | null | { [key: string]: JSONValue } | JSONValue[];

interface TreeNode {
  key: string;
  value: JSONValue;
  type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';
  path: string;
  level: number;
  isExpanded: boolean;
  children?: TreeNode[];
}

function getValueType(value: JSONValue): TreeNode['type'] {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  return typeof value as 'string' | 'number' | 'boolean';
}

function parseJSONToTree(json: string): TreeNode | null {
  try {
    const parsed = JSON.parse(json);
    return createTreeNode('root', parsed, '', 0);
  } catch {
    return null;
  }
}

function createTreeNode(key: string, value: JSONValue, parentPath: string, level: number): TreeNode {
  const path = parentPath ? `${parentPath}.${key}` : key;
  const type = getValueType(value);

  const node: TreeNode = {
    key,
    value,
    type,
    path,
    level,
    isExpanded: level < 2, // Auto-expand first 2 levels
  };

  if (type === 'object' && value !== null) {
    const obj = value as { [key: string]: JSONValue };
    let entries = Object.entries(obj);

    // If this is a transform component, reorder to put parent first
    if (key === 'transform' || path === 'root.transform' || path.endsWith('.transform')) {
      const parentEntry = entries.find(([k]) => k === 'parent');
      const typeEntry = entries.find(([k]) => k === 'type');
      const otherEntries = entries.filter(([k]) => k !== 'parent' && k !== 'type');

      // Reconstruct entries with parent first, then type, then rest
      entries = [];
      if (parentEntry) entries.push(parentEntry);
      if (typeEntry) entries.push(typeEntry);
      entries.push(...otherEntries);
    }

    node.children = entries.map(([k, v]) =>
      createTreeNode(k, v, path, level + 1)
    );
  } else if (type === 'array') {
    const arr = value as JSONValue[];
    node.children = arr.map((v, i) =>
      createTreeNode(String(i), v, path, level + 1)
    );
  }

  return node;
}

function getRootChildren(tree: TreeNode): TreeNode[] {
  // If root is an object or array, return its children directly
  if ((tree.type === 'object' || tree.type === 'array') && tree.children) {
    return tree.children;
  }
  // Otherwise return empty array
  return [];
}

function getTypeColor(type: TreeNode['type']): string {
  switch (type) {
    case 'string':
      return 'var(--vscode-symbolIcon-stringForeground, #ce9178)'; // Orange/red
    case 'number':
      return 'var(--vscode-symbolIcon-numberForeground, #b5cea8)'; // Green
    case 'boolean':
      return 'var(--vscode-symbolIcon-keywordForeground, #569cd6)'; // Blue
    case 'null':
      return 'var(--vscode-symbolIcon-keywordForeground, #569cd6)'; // Blue
    case 'object':
      return 'var(--vscode-symbolIcon-objectForeground, #4ec9b0)'; // Cyan
    case 'array':
      return 'var(--vscode-symbolIcon-arrayForeground, #4ec9b0)'; // Cyan
    default:
      return 'var(--vscode-editor-foreground, #cccccc)';
  }
}

function formatValue(value: JSONValue, type: TreeNode['type']): string {
  if (type === 'null') return 'null';
  if (type === 'string') return JSON.stringify(value);
  if (type === 'boolean') return String(value);
  if (type === 'number') return String(value);
  if (type === 'array') {
    return '';
  }
  if (type === 'object') {
    return '';
  }
  return String(value);
}

interface TreeNodeComponentProps {
  node: TreeNode;
  expandedPaths: Set<string>;
  onToggleExpand: (path: string) => void;
  onNodeClick?: (path: string, value: JSONValue) => void;
  onValueChange?: (path: string, newValue: JSONValue) => void;
  onAddChild?: (path: string, key: string | null, value: JSONValue) => void;
  onRemoveNode?: (path: string) => void;
  onRenameKey?: (path: string, newKey: string) => void;
  rootData: any;
  isInGridContainer?: boolean;
  ecs?: ECSInstance;
  entity?: Entity;
}

function getPropertyInputType(path: string): PropertyInputType | null {
  // Extract component type from path (e.g., "position.x" -> "position")
  const pathParts = path.split('.').filter(p => p !== 'root');
  if (pathParts.length < 2) return null;

  const componentType = pathParts[0];
  const propertyName = pathParts[pathParts.length - 1];

  const componentDef = componentRegistry[componentType];
  if (!componentDef?.propertyInputTypes) return null;

  // Check for exact property name match
  if (componentDef.propertyInputTypes[propertyName]) {
    return componentDef.propertyInputTypes[propertyName];
  }

  // Check for nested path (e.g., "collider.bodyType")
  const fullPath = pathParts.slice(1).join('.');
  if (componentDef.propertyInputTypes[fullPath]) {
    return componentDef.propertyInputTypes[fullPath];
  }

  return null;
}

const parseDropdownNumericOption = (option: string): number | null => {
  const match = option.trim().match(/^(-?0x[0-9a-fA-F]+|-?\d+)/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isNaN(parsed) ? null : parsed;
};

const parseBitmaskOption = (option: string): { bit: number; label: string } | null => {
  const bit = parseDropdownNumericOption(option);
  if (!bit) return null;
  const label = option.includes(":") ? option.split(":").slice(1).join(":").trim() : option.trim();
  return { bit, label: label || String(bit) };
};

const formatBitmaskValue = (value: number, options: string[]): string => {
  const parsed = options
    .map(parseBitmaskOption)
    .filter((option): option is { bit: number; label: string } => !!option);
  if (parsed.length === 0) return "None";
  const labels = parsed
    .filter(({ bit }) => (value & bit) !== 0)
    .map(({ label }) => label);
  if (labels.length === 0) return "None";
  return labels.join(", ");
};

function BitmaskDropdown({
  value,
  options,
  onChange,
}: {
  value: number;
  options: string[];
  onChange: (value: number) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const parsedOptions = useMemo(
    () =>
      options
        .map(parseBitmaskOption)
        .filter((option): option is { bit: number; label: string } => !!option),
    [options]
  );

  const allBits = useMemo(
    () => parsedOptions.reduce((acc, option) => acc | option.bit, 0),
    [parsedOptions]
  );

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      <div
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        style={{
          display: "flex",
          alignItems: "center",
          cursor: "pointer",
          minHeight: "20px",
          padding: "2px 4px",
          color: "var(--vscode-symbolIcon-numberForeground, #b5cea8)",
          fontSize: "inherit",
          width: "100%",
        }}
      >
        <span style={{ flex: 1, textAlign: "left" }}>
          {formatBitmaskValue(value, options)}
        </span>
        <CaretDown
          size={10}
          weight="bold"
          style={{
            color: "var(--vscode-descriptionForeground, #808080)",
            marginLeft: "4px",
            transform: isOpen ? "rotate(180deg)" : "none",
            transition: "transform 0.1s",
          }}
        />
      </div>
      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            zIndex: 1000,
            backgroundColor: "var(--vscode-dropdown-background, var(--vscode-editor-background, #1e1e1e))",
            border: "1px solid var(--vscode-dropdown-border, rgba(255, 255, 255, 0.1))",
            marginTop: "2px",
            maxHeight: "200px",
            overflowY: "auto",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {parsedOptions.length === 0 ? (
            <div
              style={{
                padding: "4px 8px",
                textAlign: "center",
                color: "var(--vscode-descriptionForeground, #808080)",
                fontSize: "inherit",
              }}
            >
              No layers defined
            </div>
          ) : (
            <>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "4px 8px",
                  borderBottom: "1px solid var(--vscode-dropdown-border, rgba(255, 255, 255, 0.1))",
                }}
              >
                <button
                  onClick={() => onChange(0)}
                  style={{
                    backgroundColor: "transparent",
                    border: "none",
                    color: "var(--vscode-descriptionForeground, #808080)",
                    cursor: "pointer",
                    fontSize: "inherit",
                  }}
                >
                  None
                </button>
                <button
                  onClick={() => onChange(allBits)}
                  style={{
                    backgroundColor: "transparent",
                    border: "none",
                    color: "var(--vscode-descriptionForeground, #808080)",
                    cursor: "pointer",
                    fontSize: "inherit",
                  }}
                >
                  All
                </button>
              </div>
              {parsedOptions.map(({ bit, label }) => {
                const checked = (value & bit) !== 0;
                return (
                  <label
                    key={`${bit}:${label}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "4px 8px",
                      cursor: "pointer",
                      color: "var(--vscode-editor-foreground, #cccccc)",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        const nextValue = checked ? (value & ~bit) : (value | bit);
                        onChange(nextValue);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      style={{ margin: 0 }}
                    />
                    <span>{label}</span>
                  </label>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function TreeNodeComponent({
  node,
  expandedPaths,
  onToggleExpand,
  onNodeClick,
  onValueChange,
  onAddChild,
  onRemoveNode,
  onRenameKey,
  rootData,
  isInGridContainer = false,
  ecs,
  entity
}: TreeNodeComponentProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [isAddingChild, setIsAddingChild] = useState(false);
  const [newChildKey, setNewChildKey] = useState('');
  const [newChildValue, setNewChildValue] = useState('');
  const [isHovered, setIsHovered] = useState(false);
  const [isEditingKey, setIsEditingKey] = useState(false);
  const [editKeyValue, setEditKeyValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const keyInputRef = useRef<HTMLInputElement>(null);
  const isExpanded = expandedPaths.has(node.path);
  const hasChildren = node.children && node.children.length > 0;
  const typeColor = getTypeColor(node.type);
  const indent = node.level * 16;
  const isObjectOrArray = node.type === 'object' || node.type === 'array';
  const isTypeField = node.key === 'type';
  const isEditable = !isObjectOrArray && node.key !== 'root' && !isTypeField;
  const isArrayIndex = /^\d+$/.test(node.key);
  const isKeyEditable = node.key !== 'root' && !isTypeField && !isArrayIndex && !!onRenameKey;
  const canAddChild = isObjectOrArray && node.key !== 'root' && !!onAddChild;
  const canRemoveNode = node.key !== 'root' && !isTypeField && !!onRemoveNode;
  const isTransformParent = node.path === 'root.transform.parent' ||
    node.path === 'transform.parent' ||
    node.path.endsWith('.transform.parent');

  // Get custom input type for this property
  const customInputType = useMemo(() => {
    if (!isEditable) return null;
    return getPropertyInputType(node.path);
  }, [node.path, isEditable]);

  const dropdownOptions = useMemo(() => {
    if (customInputType?.type !== 'dropdown') return [];
    return typeof customInputType.options === 'function'
      ? customInputType.options()
      : customInputType.options;
  }, [customInputType]);

  const bitmaskOptions = useMemo(() => {
    if (customInputType?.type !== 'bitmask') return [];
    return typeof customInputType.options === 'function'
      ? customInputType.options()
      : customInputType.options;
  }, [customInputType]);

  const dropdownDisplayValue = useMemo(() => {
    if (customInputType?.type !== 'dropdown') return String(node.value ?? '');
    if (node.type !== 'number') return String(node.value ?? '');
    const numericValue = typeof node.value === 'number' ? node.value : Number(node.value);
    if (Number.isNaN(numericValue)) return String(node.value ?? '');
    const matched = dropdownOptions.find(option => parseDropdownNumericOption(option) === numericValue);
    return matched ?? String(node.value ?? '');
  }, [customInputType, dropdownOptions, node.type, node.value]);

  // Get available entities for parent selection (excluding self and descendants)
  const availableParentEntities = useMemo(() => {
    if (!isTransformParent || !ecs || !entity) return [];

    const allEntities = Object.keys(ecs.entities);

    // Helper to check if an entity is a descendant
    const isDescendant = (parent: Entity, child: Entity): boolean => {
      const children = getChildren(ecs, parent);
      if (children.includes(child)) return true;
      for (const c of children) {
        if (isDescendant(c, child)) return true;
      }
      return false;
    };

    // Filter out self and descendants
    return allEntities.filter(e => {
      if (e === entity) return false;
      if (isDescendant(entity, e)) return false;
      return true;
    });
  }, [isTransformParent, ecs, entity]);

  const handleRowClick = () => {
    if (isObjectOrArray && hasChildren) {
      onToggleExpand(node.path);
    } else if (!isObjectOrArray && !isEditing && isEditable) {
      // For dropdown, file, and color types, don't enter edit mode - they handle their own state
      if (customInputType?.type === 'dropdown' || customInputType?.type === 'file' || customInputType?.type === 'color') {
        // These components will handle their own opening
        return;
      }
      setIsEditing(true);
      if (node.type === 'string') {
        setEditValue(String(node.value));
      } else {
        setEditValue(String(node.value));
      }
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

  const parseInputValue = (rawValue: string): JSONValue => {
    const trimmed = rawValue.trim();
    if (trimmed === '') return '';
    if (trimmed === 'null') return null;
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    const asNumber = Number(trimmed);
    if (!Number.isNaN(asNumber) && trimmed !== '') return asNumber;
    try {
      return JSON.parse(trimmed) as JSONValue;
    } catch {
      return trimmed;
    }
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
    // Special handling for transform.parent - use setParent function
    if (isTransformParent && ecs && entity) {
      const parentId = newValue === null || newValue === '' || newValue === undefined
        ? null
        : String(newValue);

      // Validate parent exists if not null
      if (parentId && !ecs.entities[parentId]) {
        console.warn(`Parent entity "${parentId}" does not exist`);
        return;
      }

      // Use setParent to properly handle transform conversion
      setParent(ecs, entity, parentId);

      // Trigger onChange to refresh the view
      if (onValueChange) {
        // Get the updated value from the transform component
        const transform = ecs.entities[entity]?.transform;
        const updatedValue: JSONValue = (transform && 'parent' in transform && typeof transform.parent === 'string')
          ? transform.parent
          : null;
        onValueChange(node.path, updatedValue);
      }
    } else if (onValueChange) {
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

  if (isObjectOrArray) {
    return (
      <>
        <div
          className="json-tree-row"
          style={{
            display: 'flex',
            backgroundColor: 'transparent',
            cursor: hasChildren ? 'pointer' : 'default',
            minHeight: '20px',
            width: '100%',
            boxSizing: 'border-box',
          }}
          onClick={handleRowClick}
          onMouseEnter={(e) => {
            setIsHovered(true);
            e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground, rgba(255, 255, 255, 0.05))';
          }}
          onMouseLeave={(e) => {
            setIsHovered(false);
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between', paddingLeft: `${indent}px`, padding: '4px 2px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {hasChildren && (
                <span style={{
                  transform: isExpanded ? 'rotate(90deg)' : 'none',
                  transition: 'transform 0.1s',
                  display: 'inline-block',
                  fontSize: '10px',
                  color: 'var(--vscode-editor-foreground, #cccccc)',
                  width: '12px',
                  textAlign: 'center',
                  flexShrink: 0,
                }}>
                  ▶
                </span>
              )}
              <span style={{ color: 'var(--vscode-editor-foreground, #cccccc)', fontSize: 'inherit' }}>
                {node.key !== 'root' && (
                  isEditingKey ? (
                    <input
                      ref={keyInputRef}
                      type="text"
                      value={editKeyValue}
                      size={Math.max(1, editKeyValue.length)}
                      onChange={(e) => setEditKeyValue(e.target.value)}
                      onKeyDown={handleKeyEditKeyDown}
                      onBlur={handleKeyEditBlur}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        backgroundColor: 'transparent',
                        border: '1px solid rgba(128, 128, 128, 0.35)',
                        color: 'var(--vscode-editor-foreground, #cccccc)',
                        fontSize: 'inherit',
                        padding: '1px 4px',
                        borderRadius: '2px',
                        fontFamily: 'inherit',
                        width: 'auto',
                      }}
                    />
                  ) : (
                    <span
                      style={{ fontWeight: 500, cursor: isKeyEditable ? 'text' : 'default' }}
                      onClick={handleStartEditKey}
                    >
                      {node.key}
                    </span>
                  )
                )}
              </span>
              {!isObjectOrArray && (
                <span style={{ color: typeColor, fontSize: 'inherit' }}>
                  {formatValue(node.value, node.type)}
                </span>
              )}
            </div>
            {(canAddChild || canRemoveNode) && (
              <div
                style={{
                  display: 'flex',
                  gap: '4px',
                  opacity: isHovered ? 1 : 0,
                  pointerEvents: isHovered ? 'auto' : 'none',
                  transition: 'opacity 0.1s',
                }}
              >
                {canAddChild && (
                  <button
                    type="button"
                    onClick={handleStartAddChild}
                    className="bg-transparent border-none cursor-pointer p-0 rounded-md flex items-center justify-center transition-colors duration-100 text-[var(--vscode-foreground,rgba(255,255,255,0.9))] hover:bg-[var(--vscode-list-hoverBackground,rgba(255,255,255,0.1))]"
                    title="Add child"
                  >
                    <Plus size={12} weight="bold" />
                  </button>
                )}
                {canRemoveNode && (
                  <button
                    type="button"
                    onClick={handleRemoveNode}
                    className="bg-transparent border-none cursor-pointer p-0 rounded-md flex items-center justify-center transition-colors duration-100 text-[var(--vscode-errorForeground,#f48771)] hover:bg-[var(--vscode-list-hoverBackground,rgba(255,255,255,0.1))]"
                    title="Remove node"
                  >
                    <Trash size={12} weight="bold" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        {isAddingChild && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              paddingLeft: `${indent + 16}px`,
              padding: '2px 2px 4px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {node.type === 'object' && (
              <input
                type="text"
                value={newChildKey}
                onChange={(e) => setNewChildKey(e.target.value)}
                placeholder="key"
                style={{
                  backgroundColor: 'transparent',
                  border: '1px solid rgba(128, 128, 128, 0.35)',
                  color: 'var(--vscode-editor-foreground, #cccccc)',
                  fontSize: 'inherit',
                  padding: '1px 4px',
                  borderRadius: '2px',
                  width: '120px',
                  fontFamily: 'inherit',
                }}
              />
            )}
            <input
              type="text"
              value={newChildValue}
              onChange={(e) => setNewChildValue(e.target.value)}
              placeholder="value (JSON)"
              style={{
                backgroundColor: 'transparent',
                border: '1px solid rgba(128, 128, 128, 0.35)',
                color: 'var(--vscode-editor-foreground, #cccccc)',
                fontSize: 'inherit',
                padding: '1px 4px',
                borderRadius: '2px',
                flex: 1,
                minWidth: '120px',
                fontFamily: 'inherit',
              }}
            />
            <button
              type="button"
              onClick={handleConfirmAddChild}
              className="bg-transparent border-none cursor-pointer p-0 rounded-md flex items-center justify-center transition-colors duration-100 text-[var(--vscode-foreground,rgba(255,255,255,0.9))] hover:bg-[var(--vscode-list-hoverBackground,rgba(255,255,255,0.1))]"
              title="Add"
            >
              <Check size={12} weight="bold" />
            </button>
            <button
              type="button"
              onClick={handleCancelAddChild}
              className="bg-transparent border-none cursor-pointer p-0 rounded-md flex items-center justify-center transition-colors duration-100 text-[var(--vscode-foreground,rgba(255,255,255,0.9))] hover:bg-[var(--vscode-list-hoverBackground,rgba(255,255,255,0.1))]"
              title="Cancel"
            >
              <X size={12} weight="bold" />
            </button>
          </div>
        )}
        {hasChildren && isExpanded && node.children && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '16px auto 1fr',
            width: '100%',
          }}>
            {node.children.map((child) => (
              <TreeNodeComponent
                key={child.path}
                node={child}
                expandedPaths={expandedPaths}
                onToggleExpand={onToggleExpand}
                onNodeClick={onNodeClick}
                onValueChange={onValueChange}
                onAddChild={onAddChild}
                onRemoveNode={onRemoveNode}
                onRenameKey={onRenameKey}
                rootData={rootData}
                isInGridContainer={true}
                ecs={ecs}
                entity={entity}
              />
            ))}
          </div>
        )}
      </>
    );
  }

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


  const rowId = `row-${node.path}`;

  return (
    <>
      {isInGridContainer ? (
        <>
          <div
            data-row-id={rowId}
            style={{
              display: 'flex',
              alignItems: 'center',
              paddingLeft: `${indent}px`,
              padding: '1px 2px',
              backgroundColor: 'transparent',
              cursor: isEditable ? 'pointer' : 'default',
              width: '100%',
              boxSizing: 'border-box',
            }}
            onClick={handleRowClick}
            onMouseEnter={(e) => {
              setIsHovered(true);
              const rowId = e.currentTarget.getAttribute('data-row-id');
              if (rowId) {
                const cells = document.querySelectorAll(`[data-row-id="${rowId}"]`);
                cells.forEach((cell: any) => {
                  cell.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                });
              }
            }}
            onMouseLeave={(e) => {
              setIsHovered(false);
              const rowId = e.currentTarget.getAttribute('data-row-id');
              if (rowId) {
                const cells = document.querySelectorAll(`[data-row-id="${rowId}"]`);
                cells.forEach((cell: any) => {
                  cell.style.backgroundColor = 'transparent';
                });
              }
            }}
          >
            {hasChildren && (
              <span style={{
                transform: isExpanded ? 'rotate(90deg)' : 'none',
                transition: 'transform 0.1s',
                display: 'inline-block',
                fontSize: '10px',
                color: 'var(--vscode-editor-foreground, #cccccc)',
                width: '12px',
                textAlign: 'center',
              }}>
                ▶
              </span>
            )}
          </div>
          <div
            data-row-id={rowId}
            style={{
              padding: '1px 2px',
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'transparent',
              cursor: isEditable ? 'pointer' : 'default',
              width: '100%',
              boxSizing: 'border-box',
            }}
            onClick={handleRowClick}
            onMouseEnter={(e) => {
              setIsHovered(true);
              const rowId = e.currentTarget.getAttribute('data-row-id');
              if (rowId) {
                const cells = document.querySelectorAll(`[data-row-id="${rowId}"]`);
                cells.forEach((cell: any) => {
                  cell.style.backgroundColor = 'var(--vscode-list-hoverBackground, rgba(255, 255, 255, 0.05))';
                });
              }
            }}
            onMouseLeave={(e) => {
              setIsHovered(false);
              const rowId = e.currentTarget.getAttribute('data-row-id');
              if (rowId) {
                const cells = document.querySelectorAll(`[data-row-id="${rowId}"]`);
                cells.forEach((cell: any) => {
                  cell.style.backgroundColor = 'transparent';
                });
              }
            }}
          >
            <span style={{ color: 'var(--vscode-editor-foreground, #cccccc)', fontSize: 'inherit', display: 'inline-block', whiteSpace: 'nowrap' }}>
              {node.key !== 'root' && (
                <>
                  {isEditingKey ? (
                    <input
                      ref={keyInputRef}
                      type="text"
                      value={editKeyValue}
                      size={Math.max(1, editKeyValue.length)}
                      onChange={(e) => setEditKeyValue(e.target.value)}
                      onKeyDown={handleKeyEditKeyDown}
                      onBlur={handleKeyEditBlur}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        backgroundColor: 'transparent',
                        border: '1px solid rgba(128, 128, 128, 0.35)',
                        color: 'var(--vscode-editor-foreground, #cccccc)',
                        fontSize: 'inherit',
                        padding: '1px 4px',
                        borderRadius: '2px',
                        fontFamily: 'inherit',
                        width: 'auto',
                      }}
                    />
                  ) : (
                    <span
                      style={{ fontWeight: 500, cursor: isKeyEditable ? 'text' : 'default' }}
                      onClick={handleStartEditKey}
                    >
                      {node.key}
                    </span>
                  )}
                  <span style={{ color: 'var(--vscode-descriptionForeground, #808080)', margin: '0 2px' }}>:</span>
                </>
              )}
            </span>
          </div>
          <div
            data-row-id={rowId}
            style={{
              padding: '1px 2px',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'transparent',
              cursor: isEditable ? 'pointer' : 'default',
              width: '100%',
              justifyContent: 'space-between',
            }}
            onClick={handleRowClick}
            onMouseEnter={(e) => {
              setIsHovered(true);
              const rowId = e.currentTarget.getAttribute('data-row-id');
              if (rowId) {
                const cells = document.querySelectorAll(`[data-row-id="${rowId}"]`);
                cells.forEach((cell: any) => {
                  cell.style.backgroundColor = 'var(--vscode-list-hoverBackground, rgba(255, 255, 255, 0.05))';
                });
              }
            }}
            onMouseLeave={(e) => {
              setIsHovered(false);
              const rowId = e.currentTarget.getAttribute('data-row-id');
              if (rowId) {
                const cells = document.querySelectorAll(`[data-row-id="${rowId}"]`);
                cells.forEach((cell: any) => {
                  cell.style.backgroundColor = 'transparent';
                });
              }
            }}
          >
            {isTransformParent && ecs && entity ? (
              <div onClick={(e) => e.stopPropagation()} style={{ width: '100%' }}>
                <SearchableDropdown
                  value={String(node.value || '')}
                  options={['', ...availableParentEntities]}
                  onChange={(value) => handleValueChange(value === '' ? null : value)}
                  placeholder="No parent"
                />
              </div>
            ) : customInputType?.type === 'dropdown' ? (
              <div onClick={(e) => e.stopPropagation()} style={{ width: '100%' }}>
                <SearchableDropdown
                  value={dropdownDisplayValue}
                  options={dropdownOptions}
                  onChange={(value) => {
                    if (node.type === 'number') {
                      const parsed = parseDropdownNumericOption(value);
                      handleValueChange(parsed ?? value);
                      return;
                    }
                    handleValueChange(value);
                  }}
                />
              </div>
            ) : customInputType?.type === 'bitmask' ? (
              <div onClick={(e) => e.stopPropagation()} style={{ width: '100%' }}>
                <BitmaskDropdown
                  value={typeof node.value === 'number' ? node.value : Number(node.value) || 0}
                  options={bitmaskOptions}
                  onChange={(value) => handleValueChange(value)}
                />
              </div>
            ) : customInputType?.type === 'file' ? (
              <div onClick={(e) => e.stopPropagation()} style={{ width: '100%' }}>
                <FileInput
                  value={String(node.value || '')}
                  accept={customInputType.accept}
                  directory={customInputType.directory}
                  onChange={(value) => handleValueChange(value)}
                />
              </div>
            ) : customInputType?.type === 'color' ? (
              <div onClick={(e) => e.stopPropagation()} style={{ width: '100%' }}>
                <ColorInput
                  value={String(node.value || '#000000')}
                  onChange={(value) => handleValueChange(value)}
                />
              </div>
            ) : isEditing ? (
              <input
                ref={inputRef}
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                onClick={(e) => e.stopPropagation()}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: typeColor,
                  fontSize: 'inherit',
                  padding: 0,
                  margin: 0,
                  outline: 'none',
                  width: '100%',
                  fontFamily: 'inherit',
                  display: 'block',
                }}
              />
            ) : (
              <>
                {node.type === 'boolean' ? (
                  <input
                    type="checkbox"
                    checked={node.value === true}
                    onChange={(e) => {
                      e.stopPropagation();
                      handleValueChange(e.target.checked);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      cursor: 'pointer',
                      margin: 0,
                      marginRight: '2px',
                      verticalAlign: 'middle',
                    }}
                  />
                ) : (
                  <span style={{
                    color: isTypeField ? 'var(--vscode-editor-foreground, #cccccc)' : typeColor,
                    fontSize: 'inherit',
                    display: 'inline-block',
                    backgroundColor: isTypeField ? 'var(--vscode-textBlockQuote-background, rgba(128, 128, 128, 0.1))' : 'transparent',
                    padding: isTypeField ? '1px 4px' : '0',
                    borderRadius: isTypeField ? '2px' : '0'
                  }}>
                    {isTypeField && node.type === 'string' ? String(node.value) : formatValue(node.value, node.type)}
                  </span>
                )}
              </>
            )}
            {canRemoveNode && (
              <button
                type="button"
                onClick={handleRemoveNode}
                className="bg-transparent border-none cursor-pointer p-0 rounded-md flex items-center justify-center transition-colors duration-100 text-[var(--vscode-errorForeground,#f48771)] hover:bg-[var(--vscode-list-hoverBackground,rgba(255,255,255,0.1))]"
                style={{
                  opacity: isHovered ? 1 : 0,
                  pointerEvents: isHovered ? 'auto' : 'none',
                  transition: 'opacity 0.1s',
                }}
                title="Remove node"
              >
                <Trash size={12} weight="bold" />
              </button>
            )}
          </div>
        </>
      ) : (
        <div
          className="json-tree-row"
          style={{
            display: 'flex',
            backgroundColor: 'transparent',
            cursor: isEditable ? 'pointer' : 'default',
            minHeight: '20px',
            width: '100%',
            boxSizing: 'border-box',
          }}
          onClick={handleRowClick}
          onMouseEnter={(e) => {
            setIsHovered(true);
            e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground, rgba(255, 255, 255, 0.05))';
          }}
          onMouseLeave={(e) => {
            setIsHovered(false);
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            paddingLeft: `${indent}px`,
            padding: '1px 2px',
            width: '100%',
            boxSizing: 'border-box',
          }}>
            <div style={{
              width: '16px',
              minWidth: '16px',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
            }}>
              {hasChildren && (
                <span style={{
                  transform: isExpanded ? 'rotate(90deg)' : 'none',
                  transition: 'transform 0.1s',
                  display: 'inline-block',
                  fontSize: '10px',
                  color: 'var(--vscode-editor-foreground, #cccccc)',
                  width: '12px',
                  textAlign: 'center',
                }}>
                  ▶
                </span>
              )}
            </div>
            <div style={{
              flex: '0 0 auto',
              display: 'flex',
              alignItems: 'center',
            }}>
              <span style={{ color: 'var(--vscode-editor-foreground, #cccccc)', fontSize: 'inherit', display: 'inline-block', whiteSpace: 'nowrap' }}>
                {node.key !== 'root' && (
                  <>
                    {isEditingKey ? (
                      <input
                        ref={keyInputRef}
                        type="text"
                        value={editKeyValue}
                        size={Math.max(1, editKeyValue.length)}
                        onChange={(e) => setEditKeyValue(e.target.value)}
                        onKeyDown={handleKeyEditKeyDown}
                        onBlur={handleKeyEditBlur}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          backgroundColor: 'transparent',
                          border: '1px solid rgba(128, 128, 128, 0.35)',
                          color: 'var(--vscode-editor-foreground, #cccccc)',
                          fontSize: 'inherit',
                          padding: '1px 4px',
                          borderRadius: '2px',
                          fontFamily: 'inherit',
                          width: 'auto',
                        }}
                      />
                    ) : (
                      <span
                        style={{ fontWeight: 500, cursor: isKeyEditable ? 'text' : 'default' }}
                        onClick={handleStartEditKey}
                      >
                        {node.key}
                      </span>
                    )}
                    <span style={{ color: 'var(--vscode-descriptionForeground, #808080)', margin: '0 2px' }}>:</span>
                  </>
                )}
              </span>
            </div>
            <div style={{
              position: 'relative',
              flex: '0 0 auto',
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              justifyContent: 'space-between',
            }}>
              {isTransformParent && ecs && entity ? (
                <div onClick={(e) => e.stopPropagation()} style={{ width: '100%' }}>
                  <SearchableDropdown
                    value={String(node.value || '')}
                    options={['', ...availableParentEntities]}
                    onChange={(value) => handleValueChange(value === '' ? null : value)}
                    placeholder="No parent"
                  />
                </div>
              ) : customInputType?.type === 'dropdown' ? (
                <div onClick={(e) => e.stopPropagation()} style={{ width: '100%' }}>
                  <SearchableDropdown
                    value={dropdownDisplayValue}
                    options={dropdownOptions}
                    onChange={(value) => {
                      if (node.type === 'number') {
                        const parsed = parseDropdownNumericOption(value);
                        handleValueChange(parsed ?? value);
                        return;
                      }
                      handleValueChange(value);
                    }}
                  />
                </div>
              ) : customInputType?.type === 'bitmask' ? (
                <div onClick={(e) => e.stopPropagation()} style={{ width: '100%' }}>
                  <BitmaskDropdown
                    value={typeof node.value === 'number' ? node.value : Number(node.value) || 0}
                    options={bitmaskOptions}
                    onChange={(value) => handleValueChange(value)}
                  />
                </div>
              ) : customInputType?.type === 'file' ? (
                <div onClick={(e) => e.stopPropagation()} style={{ width: '100%' }}>
                  <FileInput
                    value={String(node.value || '')}
                    accept={customInputType.accept}
                    directory={customInputType.directory}
                    onChange={(value) => handleValueChange(value)}
                  />
                </div>
              ) : customInputType?.type === 'color' ? (
                <div onClick={(e) => e.stopPropagation()} style={{ width: '100%' }}>
                  <ColorInput
                    value={String(node.value || '#000000')}
                    onChange={(value) => handleValueChange(value)}
                  />
                </div>
              ) : isEditing ? (
                <input
                  ref={inputRef}
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={handleBlur}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: typeColor,
                    fontSize: 'inherit',
                    padding: 0,
                    margin: 0,
                    outline: 'none',
                    width: '100%',
                    fontFamily: 'inherit',
                    display: 'block',
                  }}
                />
              ) : (
                <>
                  {node.type === 'boolean' ? (
                    <input
                      type="checkbox"
                      checked={node.value === true}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleValueChange(e.target.checked);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        cursor: 'pointer',
                        margin: 0,
                        marginRight: '2px',
                        verticalAlign: 'middle',
                      }}
                    />
                  ) : (
                    <span style={{
                      color: isTypeField ? 'var(--vscode-editor-foreground, #cccccc)' : typeColor,
                      fontSize: 'inherit',
                      display: 'inline-block'
                    }}>
                      {isTypeField && node.type === 'string' ? String(node.value) : formatValue(node.value, node.type)}
                    </span>
                  )}
                </>
              )}
              {canRemoveNode && (
                <button
                  type="button"
                  onClick={handleRemoveNode}
                  className="bg-transparent border-none cursor-pointer p-0 rounded-md flex items-center justify-center transition-colors duration-100 text-[var(--vscode-errorForeground,#f48771)] hover:bg-[var(--vscode-list-hoverBackground,rgba(255,255,255,0.1))]"
                  style={{
                    opacity: isHovered ? 1 : 0,
                    pointerEvents: isHovered ? 'auto' : 'none',
                    transition: 'opacity 0.1s',
                  }}
                  title="Remove node"
                >
                  <Trash size={12} weight="bold" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {hasChildren && isExpanded && node.children && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '16px auto 1fr',
          width: '100%',
        }}>
          {node.children.map((child) => (
            <TreeNodeComponent
              key={child.path}
              node={child}
              expandedPaths={expandedPaths}
              onToggleExpand={onToggleExpand}
              onNodeClick={onNodeClick}
              onValueChange={onValueChange}
              onAddChild={onAddChild}
              onRemoveNode={onRemoveNode}
              onRenameKey={onRenameKey}
              rootData={rootData}
              isInGridContainer={true}
              ecs={ecs}
              entity={entity}
            />
          ))}
        </div>
      )}
    </>
  );
}

export function JSONTreeView({ json, onNodeSelect, onChange, className = '', ecs, entity }: JSONTreeViewProps) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [localData, setLocalData] = useState(json);

  useEffect(() => {
    setLocalData(json);
  }, [json]);

  const tree = useMemo(() => parseJSONToTree(localData), [localData]);

  // Initialize expanded paths from tree
  useMemo(() => {
    if (tree) {
      const initialExpanded = new Set<string>();
      const collectPaths = (node: TreeNode) => {
        if (node.isExpanded && node.children && node.children.length > 0) {
          initialExpanded.add(node.path);
          node.children.forEach(collectPaths);
        }
      };
      // Start from root's children, not root itself
      getRootChildren(tree).forEach(collectPaths);
      setExpandedPaths(initialExpanded);
    }
  }, [tree]);

  const toggleExpand = useCallback((path: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const updateValueAtPath = useCallback((path: string, newValue: JSONValue) => {
    try {
      const pathParts = path.split('.').filter(p => p !== 'root');

      // Prevent updates to "type" fields
      if (pathParts.length > 0 && pathParts[pathParts.length - 1] === 'type') {
        console.warn('Cannot modify "type" field - it is immutable');
        return;
      }

      const data = JSON.parse(localData);

      const setNestedValue = (obj: any, pathParts: string[], value: JSONValue) => {
        if (pathParts.length === 1) {
          const key = pathParts[0];
          // Check if we're dealing with an array index
          const arrayIndex = /^\d+$/.test(key) ? parseInt(key, 10) : -1;

          if (Array.isArray(obj) && arrayIndex >= 0 && arrayIndex < obj.length) {
            // Update array element
            obj[arrayIndex] = value;
          } else if (typeof obj === 'object' && obj !== null) {
            // Update object property
            obj[key] = value;
          }
        } else {
          const [first, ...rest] = pathParts;
          const arrayIndex = /^\d+$/.test(first) ? parseInt(first, 10) : -1;

          if (Array.isArray(obj) && arrayIndex >= 0 && arrayIndex < obj.length) {
            // Navigate into array element
            setNestedValue(obj[arrayIndex], rest, value);
          } else if (typeof obj === 'object' && obj !== null && obj[first] !== undefined) {
            // Navigate into object property (only if it exists)
            setNestedValue(obj[first], rest, value);
          } else {
            // Path doesn't exist, don't create it
            console.warn(`Path ${path} does not exist in the data structure`);
            return;
          }
        }
      };

      if (pathParts.length > 0) {
        setNestedValue(data, pathParts, newValue);
        const updatedJson = JSON.stringify(data, null, 2);
        setLocalData(updatedJson);
        onChange?.(updatedJson);
      }
    } catch (error) {
      console.error('Error updating value:', error);
    }
  }, [localData, onChange]);

  const renameKeyAtPath = useCallback((path: string, newKey: string) => {
    try {
      const pathParts = path.split('.').filter(p => p !== 'root');
      if (pathParts.length === 0) return;
      const oldKey = pathParts[pathParts.length - 1];
      const parentParts = pathParts.slice(0, -1);
      const data = JSON.parse(localData);

      const getTarget = (obj: any, parts: string[]): any => {
        if (parts.length === 0) return obj;
        const [first, ...rest] = parts;
        const arrayIndex = /^\d+$/.test(first) ? parseInt(first, 10) : -1;
        if (Array.isArray(obj) && arrayIndex >= 0 && arrayIndex < obj.length) {
          return getTarget(obj[arrayIndex], rest);
        }
        if (typeof obj === 'object' && obj !== null && obj[first] !== undefined) {
          return getTarget(obj[first], rest);
        }
        return null;
      };

      const parent = getTarget(data, parentParts);
      if (!parent || typeof parent !== 'object' || Array.isArray(parent)) {
        return;
      }
      if (Object.prototype.hasOwnProperty.call(parent, newKey)) {
        console.warn(`Property "${newKey}" already exists at ${parentParts.join('.')}`);
        return;
      }
      const value = parent[oldKey];
      delete parent[oldKey];
      parent[newKey] = value;

      const updatedJson = JSON.stringify(data, null, 2);
      setLocalData(updatedJson);
      onChange?.(updatedJson);
    } catch (error) {
      console.error('Error renaming key:', error);
    }
  }, [localData, onChange]);

  const addChildAtPath = useCallback((path: string, key: string | null, value: JSONValue) => {
    try {
      const pathParts = path.split('.').filter(p => p !== 'root');
      const data = JSON.parse(localData);

      const getTarget = (obj: any, parts: string[]): any => {
        if (parts.length === 0) return obj;
        const [first, ...rest] = parts;
        const arrayIndex = /^\d+$/.test(first) ? parseInt(first, 10) : -1;
        if (Array.isArray(obj) && arrayIndex >= 0 && arrayIndex < obj.length) {
          return getTarget(obj[arrayIndex], rest);
        }
        if (typeof obj === 'object' && obj !== null && obj[first] !== undefined) {
          return getTarget(obj[first], rest);
        }
        return null;
      };

      const target = getTarget(data, pathParts);
      if (!target) {
        console.warn(`Path ${path} does not exist in the data structure`);
        return;
      }

      if (Array.isArray(target)) {
        target.push(value);
      } else if (typeof target === 'object') {
        if (!key) return;
        if (Object.prototype.hasOwnProperty.call(target, key)) {
          console.warn(`Property "${key}" already exists at ${path}`);
          return;
        }
        target[key] = value;
      }

      const updatedJson = JSON.stringify(data, null, 2);
      setLocalData(updatedJson);
      onChange?.(updatedJson);
      setExpandedPaths(prev => new Set(prev).add(path));
    } catch (error) {
      console.error('Error adding child:', error);
    }
  }, [localData, onChange]);

  const removeNodeAtPath = useCallback((path: string) => {
    try {
      const pathParts = path.split('.').filter(p => p !== 'root');
      if (pathParts.length === 0) return;
      const data = JSON.parse(localData);

      const removeFromTarget = (obj: any, parts: string[]): void => {
        if (parts.length === 1) {
          const key = parts[0];
          const arrayIndex = /^\d+$/.test(key) ? parseInt(key, 10) : -1;
          if (Array.isArray(obj) && arrayIndex >= 0 && arrayIndex < obj.length) {
            obj.splice(arrayIndex, 1);
          } else if (typeof obj === 'object' && obj !== null) {
            delete obj[key];
          }
          return;
        }
        const [first, ...rest] = parts;
        const arrayIndex = /^\d+$/.test(first) ? parseInt(first, 10) : -1;
        if (Array.isArray(obj) && arrayIndex >= 0 && arrayIndex < obj.length) {
          removeFromTarget(obj[arrayIndex], rest);
        } else if (typeof obj === 'object' && obj !== null && obj[first] !== undefined) {
          removeFromTarget(obj[first], rest);
        } else {
          console.warn(`Path ${path} does not exist in the data structure`);
        }
      };

      removeFromTarget(data, pathParts);
      const updatedJson = JSON.stringify(data, null, 2);
      setLocalData(updatedJson);
      onChange?.(updatedJson);
    } catch (error) {
      console.error('Error removing node:', error);
    }
  }, [localData, onChange]);


  if (!tree) {
    return (
      <div className={`json-tree-view ${className}`} style={{
        padding: '16px',
        color: 'var(--vscode-errorForeground, #f48771)',
        fontSize: 'inherit',
      }}>
        Invalid JSON
      </div>
    );
  }

  return (
    <div
      className={`json-tree-view ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        backgroundColor: 'var(--vscode-editor-background, #1e1e1e)',
        color: 'var(--vscode-editor-foreground, #cccccc)',
        fontFamily: 'var(--vscode-font-family, "Consolas", "Courier New", monospace)',
        fontSize: 'var(--vscode-editor-font-size, 13px)',
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >

      {/* Tree View */}
      <div
        className="editor-scrollbar"
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          paddingLeft: 0,
          paddingRight: 0,
          paddingTop: 0,
          paddingBottom: 0,
        }}
      >
        <div style={{
          width: '100%',
        }}>
          {(() => {
            const rootChildren = getRootChildren(tree);
            const rootData = tree.value;
            return rootChildren.length > 0 ? (
              rootChildren.map((child) => (
                <TreeNodeComponent
                  key={child.path}
                  node={child}
                  expandedPaths={expandedPaths}
                  onToggleExpand={toggleExpand}
                  onNodeClick={onNodeSelect}
                  onValueChange={updateValueAtPath}
                  onAddChild={addChildAtPath}
                  onRemoveNode={removeNodeAtPath}
                  onRenameKey={renameKeyAtPath}
                  rootData={rootData}
                  ecs={ecs}
                  entity={entity}
                />
              ))
            ) : (
              <div style={{ padding: '16px', color: 'var(--vscode-descriptionForeground, #808080)', fontSize: 'inherit', textAlign: 'center' }}>
                Select a node...
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}


