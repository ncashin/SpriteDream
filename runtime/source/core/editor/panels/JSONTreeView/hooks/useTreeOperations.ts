import { useCallback } from 'react';
import type { JSONValue } from '../types';

export function useTreeOperations(
    localData: string,
    setLocalData: (data: string) => void,
    onChange?: (json: string) => void,
    setExpandedPaths?: (fn: (prev: Set<string>) => Set<string>) => void
) {
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
    }, [localData, onChange, setLocalData]);

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
    }, [localData, onChange, setLocalData]);

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
            setExpandedPaths?.(prev => new Set(prev).add(path));
        } catch (error) {
            console.error('Error adding child:', error);
        }
    }, [localData, onChange, setLocalData, setExpandedPaths]);

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
    }, [localData, onChange, setLocalData]);

    return {
        updateValueAtPath,
        renameKeyAtPath,
        addChildAtPath,
        removeNodeAtPath,
    };
}

