import { useState, useMemo, useCallback, useRef, useEffect } from 'react';

interface JSONTreeViewProps {
  json: string;
  onNodeSelect?: (path: string, value: any) => void;
  onChange?: (json: string) => void;
  className?: string;
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
    node.children = Object.entries(obj).map(([k, v]) =>
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
      return '#ce9178'; // Orange/red
    case 'number':
      return '#b5cea8'; // Green
    case 'boolean':
      return '#569cd6'; // Blue
    case 'null':
      return '#569cd6'; // Blue
    case 'object':
      return '#4ec9b0'; // Cyan
    case 'array':
      return '#4ec9b0'; // Cyan
    default:
      return '#cccccc';
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
}

function TreeNodeComponent({
  node,
  expandedPaths,
  onToggleExpand,
  onNodeClick,
  onValueChange,
  rootData
}: TreeNodeComponentProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const isExpanded = expandedPaths.has(node.path);
  const hasChildren = node.children && node.children.length > 0;
  const typeColor = getTypeColor(node.type);
  const indent = node.level * 16;
  const isObjectOrArray = node.type === 'object' || node.type === 'array';
  const isEditable = !isObjectOrArray && node.key !== 'root';

  const handleRowClick = () => {
    if (isObjectOrArray && hasChildren) {
      onToggleExpand(node.path);
    } else if (!isObjectOrArray && !isEditing) {
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
    }
  };

  const handleBlur = () => {
    if (isEditing) {
      let parsedValue: JSONValue;
      try {
        if (node.type === 'string') {
          parsedValue = editValue;
        } else if (node.type === 'number') {
          parsedValue = parseFloat(editValue);
          if (!isNaN(parsedValue as number)) {
            handleValueChange(parsedValue);
          } else {
            setIsEditing(false);
          }
        } else if (node.type === 'boolean') {
          parsedValue = editValue.toLowerCase() === 'true';
          handleValueChange(parsedValue);
        } else {
          parsedValue = editValue === 'null' ? null : editValue;
          handleValueChange(parsedValue);
        }
      } catch {
        setIsEditing(false);
      }
    }
  };

  if (isObjectOrArray) {
    return (
      <>
        <tr
          className="json-tree-row"
          style={{
            backgroundColor: 'transparent',
            cursor: hasChildren ? 'pointer' : 'default',
          }}
          onClick={handleRowClick}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <td colSpan={3} style={{ paddingLeft: `${indent}px`, padding: '4px 2px', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', minHeight: '20px' }}>
              {hasChildren && (
                <span style={{
                  transform: isExpanded ? 'rotate(90deg)' : 'none',
                  transition: 'transform 0.1s',
                  display: 'inline-block',
                  fontSize: '10px',
                  color: '#cccccc',
                  width: '12px',
                  textAlign: 'center',
                }}>
                  ▶
                </span>
              )}
              <span style={{ color: '#cccccc', fontSize: '13px' }}>
                {node.key !== 'root' && (
                  <span style={{ fontWeight: 500 }}>{node.key}</span>
                )}
              </span>
              {!isObjectOrArray && (
                <span style={{ color: typeColor, fontSize: '13px' }}>
                  {formatValue(node.value, node.type)}
                </span>
              )}
            </div>
          </td>
        </tr>
        {hasChildren && isExpanded && node.children && (
          <>
            {node.children.map((child) => (
              <TreeNodeComponent
                key={child.path}
                node={child}
                expandedPaths={expandedPaths}
                onToggleExpand={onToggleExpand}
                onNodeClick={onNodeClick}
                onValueChange={onValueChange}
                rootData={rootData}
              />
            ))}
          </>
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

  return (
    <>
      <tr
        className="json-tree-row"
        style={{
          backgroundColor: 'transparent',
          cursor: isEditable ? 'pointer' : 'default',
        }}
        onClick={handleRowClick}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <td style={{ width: '16px', minWidth: '16px', maxWidth: '16px', paddingLeft: `${indent}px`, padding: '1px 2px' }}>
          {hasChildren && (
            <span style={{
              transform: isExpanded ? 'rotate(90deg)' : 'none',
              transition: 'transform 0.1s',
              display: 'inline-block',
              fontSize: '10px',
              color: '#cccccc',
              width: '12px',
              textAlign: 'center',
            }}>
              ▶
            </span>
          )}
        </td>
        <td style={{ padding: '1px 2px', width: 'auto', minWidth: '0' }}>
          <span style={{ color: '#cccccc', fontSize: '13px', display: 'inline-block' }}>
            {node.key !== 'root' && (
              <>
                <span style={{ fontWeight: 500 }}>{node.key}</span>
                <span style={{ color: '#808080', margin: '0 2px' }}>:</span>
              </>
            )}
          </span>
        </td>
        <td style={{ padding: '1px 2px', position: 'relative', width: '200px', minWidth: '200px' }}>
          {isEditing ? (
            <input
              ref={inputRef}
              type={node.type === 'number' ? 'number' : 'text'}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              onClick={(e) => e.stopPropagation()}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: typeColor,
                fontSize: '13px',
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
              ) : null}
              <span style={{ color: typeColor, fontSize: '13px', display: 'inline-block' }}>
                {formatValue(node.value, node.type)}
              </span>
            </>
          )}
        </td>
      </tr>
      {hasChildren && isExpanded && node.children && (
        <>
          {node.children.map((child) => (
            <TreeNodeComponent
              key={child.path}
              node={child}
              expandedPaths={expandedPaths}
              onToggleExpand={onToggleExpand}
              onNodeClick={onNodeClick}
              onValueChange={onValueChange}
              rootData={rootData}
            />
          ))}
        </>
      )}
    </>
  );
}

export function JSONTreeView({ json, onNodeSelect, onChange, className = '' }: JSONTreeViewProps) {
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

      const pathParts = path.split('.').filter(p => p !== 'root');
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
        color: '#f48771',
        fontSize: '13px',
      }}>
        Invalid JSON
      </div>
    );
  }

  return (
    <div className={`json-tree-view ${className}`} style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: '#1e1e1e',
      color: '#cccccc',
      fontFamily: 'var(--vscode-font-family, "Consolas", "Courier New", monospace)',
    }}>

      {/* Tree View */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '0',
      }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          borderSpacing: 0,
        }}>
          <tbody>
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
                  />
                ))
              ) : (
                <tr>
                  <td colSpan={3} style={{ padding: '16px', color: '#808080', fontSize: '13px', textAlign: 'center' }}>
                    Select a node...
                  </td>
                </tr>
              );
            })()}
          </tbody>
        </table>
      </div>
    </div>
  );
}

