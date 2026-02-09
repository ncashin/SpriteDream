import { useMemo } from 'react';
import { SearchableDropdown } from '../../SearchableDropdown';
import { FileInput } from '../../FileInput';
import { ColorInput } from '../../ColorInput';
import { BitmaskDropdown } from './BitmaskDropdown';
import { getPropertyInputType, parseDropdownNumericOption, getTypeColor, formatValue } from '../utils';
import { getChildren, setParent } from '../../../../transform';
import type { TreeNode, JSONValue } from '../types';
import type { ECSInstance, Entity } from '../../../../ecs/ecs';

interface TreeNodeValueEditorProps {
    node: TreeNode;
    isEditing: boolean;
    editValue: string;
    onEditValueChange: (value: string) => void;
    onValueChange: (value: JSONValue) => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
    onBlur: () => void;
    inputRef: React.RefObject<HTMLInputElement>;
    ecs?: ECSInstance;
    entity?: Entity;
}

export function TreeNodeValueEditor({
    node,
    isEditing,
    editValue,
    onEditValueChange,
    onValueChange,
    onKeyDown,
    onBlur,
    inputRef,
    ecs,
    entity,
}: TreeNodeValueEditorProps) {
    const isTransformParent = node.path === 'root.transform.parent' ||
        node.path === 'transform.parent' ||
        node.path.endsWith('.transform.parent');

    // Get custom input type for this property
    const customInputType = useMemo(() => {
        if (node.type === 'object' || node.type === 'array' || node.key === 'root' || node.key === 'type') return null;
        return getPropertyInputType(node.path);
    }, [node.path, node.type, node.key]);

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
            // Get the updated value from the transform component
            const transform = ecs.entities[entity]?.transform;
            const updatedValue: JSONValue = (transform && 'parent' in transform && typeof transform.parent === 'string')
                ? transform.parent
                : null;
            onValueChange(updatedValue);
        } else {
            onValueChange(newValue);
        }
    };

    if (isTransformParent && ecs && entity) {
        return (
            <div onClick={(e) => e.stopPropagation()} style={{ width: '100%' }}>
                <SearchableDropdown
                    value={String(node.value || '')}
                    options={['', ...availableParentEntities]}
                    onChange={(value) => handleValueChange(value === '' ? null : value)}
                    placeholder="No parent"
                />
            </div>
        );
    }

    if (customInputType?.type === 'dropdown') {
        return (
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
        );
    }

    if (customInputType?.type === 'bitmask') {
        return (
            <div onClick={(e) => e.stopPropagation()} style={{ width: '100%' }}>
                <BitmaskDropdown
                    value={typeof node.value === 'number' ? node.value : Number(node.value) || 0}
                    options={bitmaskOptions}
                    onChange={(value) => handleValueChange(value)}
                />
            </div>
        );
    }

    if (customInputType?.type === 'file') {
        return (
            <div onClick={(e) => e.stopPropagation()} style={{ width: '100%' }}>
                <FileInput
                    value={String(node.value || '')}
                    accept={customInputType.accept}
                    directory={customInputType.directory}
                    onChange={(value) => handleValueChange(value)}
                />
            </div>
        );
    }

    if (customInputType?.type === 'color') {
        return (
            <div onClick={(e) => e.stopPropagation()} style={{ width: '100%' }}>
                <ColorInput
                    value={String(node.value || '#000000')}
                    onChange={(value) => handleValueChange(value)}
                />
            </div>
        );
    }

    if (isEditing) {
        return (
            <input
                ref={inputRef}
                type="text"
                value={editValue}
                onChange={(e) => onEditValueChange(e.target.value)}
                onKeyDown={onKeyDown}
                onBlur={onBlur}
                onClick={(e) => e.stopPropagation()}
                style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: getTypeColor(node.type),
                    fontSize: 'inherit',
                    padding: 0,
                    margin: 0,
                    outline: 'none',
                    width: '100%',
                    fontFamily: 'inherit',
                    display: 'block',
                }}
            />
        );
    }

    const isTypeField = node.key === 'type';
    const typeColor = getTypeColor(node.type);

    if (node.type === 'boolean') {
        return (
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
        );
    }

    return (
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
    );
}

