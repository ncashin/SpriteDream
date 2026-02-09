import { useJSONTree } from './hooks/useJSONTree';
import { useExpandedPaths } from './hooks/useExpandedPaths';
import { useTreeOperations } from './hooks/useTreeOperations';
import { TreeContextProvider, TreeNodeComponent } from './components/TreeNodeComponent';
import { getRootChildren } from './utils';
import type { JSONTreeViewProps } from './types';

export function JSONTreeView({ json, onNodeSelect, onChange, className = '', ecs, entity }: JSONTreeViewProps) {
  const { tree, localData, setLocalData } = useJSONTree(json);
  const { expandedPaths, toggleExpand, setExpandedPaths } = useExpandedPaths(tree);

  const {
    updateValueAtPath,
    renameKeyAtPath,
    addChildAtPath,
    removeNodeAtPath,
  } = useTreeOperations(localData, setLocalData, onChange, setExpandedPaths);

  if (!tree) {
    return (
      <div
        className={`json-tree-view ${className} p-4 text-inherit text-[var(--vscode-errorForeground,#f48771)]`}
      >
        Invalid JSON
      </div>
    );
  }

  return (
    <div
      className={`json-tree-view ${className} flex h-full min-h-0 flex-col bg-[var(--vscode-editor-background,#1e1e1e)] text-[var(--vscode-editor-foreground,#cccccc)] text-[13px]`}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Tree View */}
      <div
        className="editor-scrollbar flex-1 min-h-0 overflow-auto py-2"
      >
        <div className="w-full">
          {(() => {
            const rootChildren = getRootChildren(tree);
            return rootChildren.length > 0 ? (
              <TreeContextProvider
                value={{
                  expandedPaths,
                  onToggleExpand: toggleExpand,
                  onNodeClick: onNodeSelect,
                  onValueChange: updateValueAtPath,
                  onAddChild: addChildAtPath,
                  onRemoveNode: removeNodeAtPath,
                  onRenameKey: renameKeyAtPath,
                  ecs,
                  entity,
                }}
              >
                {rootChildren.map((child) => (
                  <TreeNodeComponent
                    key={child.path}
                    node={child}
                  />
                ))}
              </TreeContextProvider>
            ) : (
              <div className="p-4 text-center text-inherit text-[var(--vscode-descriptionForeground,#808080)]">
                Select a node...
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

