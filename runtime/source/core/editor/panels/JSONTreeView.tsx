import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
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

function TreeNodeComponent({
  node,
  expandedPaths,
  onToggleExpand,
  onNodeClick,
  onValueChange,
  rootData,
  isInGridContainer = false,
  ecs,
  entity
}: TreeNodeComponentProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const isExpanded = expandedPaths.has(node.path);
  const hasChildren = node.children && node.children.length > 0;
  const typeColor = getTypeColor(node.type);
  const indent = node.level * 16;
  const isObjectOrArray = node.type === 'object' || node.type === 'array';
  const isTypeField = node.key === 'type';
  const isEditable = !isObjectOrArray && node.key !== 'root' && !isTypeField;
  const isTransformParent = node.path === 'root.transform.parent' ||
  node.path === 'transform.parent' ||
  node.path.endsWith('.transform.parent');

  // Get custom input type for this property
  const customInputType = useMemo(() => {
  if (!isEditable) return null;
  return getPropertyInputType(node.path);
  }, [node.path, isEditable]);

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
      paddingLeft: `${indent}px`,
      padding: '4px 2px',
      minHeight: '20px',
    }}
    onClick={handleRowClick}
    onMouseEnter={(e) => {
      e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground, rgba(255, 255, 255, 0.05))';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.backgroundColor = 'transparent';
    }}
    >
    <div style={{ display: 'flex', alignItems: 'center', gap: '2px', width: '100%' }}>
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
        <span style={{ fontWeight: 500 }}>{node.key}</span>
      )}
      </span>
      {!isObjectOrArray && (
      <span style={{ color: typeColor, fontSize: 'inherit' }}>
        {formatValue(node.value, node.type)}
      </span>
      )}
    </div>
    </div>
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

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
  if (isEditing && inputRef.current) {
  inputRef.current.focus();
  inputRef.current.select();
  }
  }, [isEditing]);


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
      }}
      onClick={handleRowClick}
      onMouseEnter={(e) => {
      const rowId = e.currentTarget.getAttribute('data-row-id');
      if (rowId) {
        const cells = document.querySelectorAll(`[data-row-id="${rowId}"]`);
        cells.forEach((cell: any) => {
        cell.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
        });
      }
      }}
      onMouseLeave={(e) => {
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
      }}
      onClick={handleRowClick}
      onMouseEnter={(e) => {
      const rowId = e.currentTarget.getAttribute('data-row-id');
      if (rowId) {
        const cells = document.querySelectorAll(`[data-row-id="${rowId}"]`);
        cells.forEach((cell: any) => {
        cell.style.backgroundColor = 'var(--vscode-list-hoverBackground, rgba(255, 255, 255, 0.05))';
        });
      }
      }}
      onMouseLeave={(e) => {
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
        <span style={{
          fontWeight: 500
        }}>{node.key}</span>
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
      }}
      onClick={handleRowClick}
      onMouseEnter={(e) => {
      const rowId = e.currentTarget.getAttribute('data-row-id');
      if (rowId) {
        const cells = document.querySelectorAll(`[data-row-id="${rowId}"]`);
        cells.forEach((cell: any) => {
        cell.style.backgroundColor = 'var(--vscode-list-hoverBackground, rgba(255, 255, 255, 0.05))';
        });
      }
      }}
      onMouseLeave={(e) => {
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
        value={String(node.value || '')}
        options={customInputType.options}
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
    </div>
    </>
  ) : (
    <div
    className="json-tree-row"
    style={{
      display: 'flex',
      backgroundColor: 'transparent',
      cursor: isEditable ? 'pointer' : 'default',
      paddingLeft: `${indent}px`,
      padding: '1px 2px',
      minHeight: '20px',
    }}
    onClick={handleRowClick}
    onMouseEnter={(e) => {
      e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground, rgba(255, 255, 255, 0.05))';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.backgroundColor = 'transparent';
    }}
    >
    <>
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
      padding: '1px 2px',
      flex: '0 0 auto',
      display: 'flex',
      alignItems: 'center',
      }}>
      <span style={{ color: 'var(--vscode-editor-foreground, #cccccc)', fontSize: 'inherit', display: 'inline-block', whiteSpace: 'nowrap' }}>
        {node.key !== 'root' && (
        <>
          <span style={{
          fontWeight: 500
          }}>{node.key}</span>
          <span style={{ color: 'var(--vscode-descriptionForeground, #808080)', margin: '0 2px' }}>:</span>
        </>
        )}
      </span>
      </div>
      <div style={{
      padding: '1px 2px',
      position: 'relative',
      flex: '0 0 auto',
      display: 'flex',
      alignItems: 'center',
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
          value={String(node.value || '')}
          options={customInputType.options}
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
      </div>
    </>
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
  <div style={{
    flex: 1,
    minHeight: 0,
    overflow: 'auto',
    padding: '0',
    paddingTop: '8px',
    paddingBottom: '16px',
  }}>
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


