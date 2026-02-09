import { useState, useMemo, useCallback } from 'react';
import type { TreeNode } from '../types';
import { getRootChildren } from '../utils';

export function useExpandedPaths(tree: TreeNode | null) {
    const [expandedPaths, setExpandedPathsState] = useState<Set<string>>(new Set());

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
            setExpandedPathsState(initialExpanded);
        }
    }, [tree]);

    const toggleExpand = useCallback((path: string) => {
        setExpandedPathsState(prev => {
            const next = new Set(prev);
            if (next.has(path)) {
                next.delete(path);
            } else {
                next.add(path);
            }
            return next;
        });
    }, []);

    const setExpandedPaths = useCallback((fn: (prev: Set<string>) => Set<string>) => {
        setExpandedPathsState(prev => fn(prev));
    }, []);

    return { expandedPaths, toggleExpand, setExpandedPaths };
}

