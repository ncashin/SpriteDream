import { componentRegistry, type PropertyInputType } from '../../../ecs/component';
import type { TreeNode, JSONValue } from './types';

export function getValueType(value: JSONValue): TreeNode['type'] {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') return 'object';
    return typeof value as 'string' | 'number' | 'boolean';
}

export function parseJSONToTree(json: string): TreeNode | null {
    try {
        const parsed = JSON.parse(json);
        return createTreeNode('root', parsed, '', 0);
    } catch {
        return null;
    }
}

export function createTreeNode(key: string, value: JSONValue, parentPath: string, level: number): TreeNode {
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

export function getRootChildren(tree: TreeNode): TreeNode[] {
    // If root is an object or array, return its children directly
    if ((tree.type === 'object' || tree.type === 'array') && tree.children) {
        return tree.children;
    }
    // Otherwise return empty array
    return [];
}

export function getTypeColor(type: TreeNode['type']): string {
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

export function formatValue(value: JSONValue, type: TreeNode['type']): string {
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

export function getPropertyInputType(path: string): PropertyInputType | null {
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

export const parseDropdownNumericOption = (option: string): number | null => {
    const match = option.trim().match(/^(-?0x[0-9a-fA-F]+|-?\d+)/);
    if (!match) return null;
    const parsed = Number(match[1]);
    return Number.isNaN(parsed) ? null : parsed;
};

export const parseBitmaskOption = (option: string): { bit: number; label: string } | null => {
    const bit = parseDropdownNumericOption(option);
    if (!bit) return null;
    const label = option.includes(":") ? option.split(":").slice(1).join(":").trim() : option.trim();
    return { bit, label: label || String(bit) };
};

export const formatBitmaskValue = (value: number, options: string[]): string => {
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

export const parseInputValue = (rawValue: string): JSONValue => {
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

