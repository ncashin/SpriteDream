import type { ECSInstance, Entity } from '../../../ecs/ecs';

export interface JSONTreeViewProps {
    json: string;
    onNodeSelect?: (path: string, value: any) => void;
    onChange?: (json: string) => void;
    className?: string;
    ecs?: ECSInstance;
    entity?: Entity;
}

export type JSONValue = string | number | boolean | null | { [key: string]: JSONValue } | JSONValue[];

export interface TreeNode {
    key: string;
    value: JSONValue;
    type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';
    path: string;
    level: number;
    isExpanded: boolean;
    children?: TreeNode[];
}

export interface TreeNodeComponentProps {
    node: TreeNode;
}

