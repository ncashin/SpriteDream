import type { ECSInstance, Entity, EntityComponents } from "./ecs/ecs";
import { getEntity } from "./ecs/ecs";
import {
    TransformComponentDefinition,
    type TransformComponent,
} from "./ecs/component";

export type Transform = {
    x: number;
    y: number;
    rotation: number;
    scaleX: number;
    scaleY: number;
};

const DEG_TO_RAD = Math.PI / 180;
const TRANSFORM_TYPE = TransformComponentDefinition.type;

function getTransformComponent(
    ecs: ECSInstance,
    entity: Entity | EntityComponents
): TransformComponent | undefined {
    if (typeof entity === "string") {
        return getEntity(ecs, entity)[TRANSFORM_TYPE] as TransformComponent | undefined;
    }
    return entity[TRANSFORM_TYPE] as TransformComponent | undefined;
}

export function getTransform(ecs: ECSInstance, entity: Entity | EntityComponents): Transform | null {
    const t = getTransformComponent(ecs, entity);
    if (!t) return null;
    return {
        x: t.x,
        y: t.y,
        rotation: t.rotation ?? 0,
        scaleX: t.scaleX ?? 1,
        scaleY: t.scaleY ?? 1,
    };
}

export function getWorldTransform(ecs: ECSInstance, entity: Entity | EntityComponents): Transform | null {
    const t = getTransformComponent(ecs, entity);
    if (!t) return null;

    const localX = t.x;
    const localY = t.y;
    const localRotation = t.rotation ?? 0;
    const localScaleX = t.scaleX ?? 1;
    const localScaleY = t.scaleY ?? 1;
    const parentId = t.parent;

    if (!parentId) {
        return { x: localX, y: localY, rotation: localRotation, scaleX: localScaleX, scaleY: localScaleY };
    }

    const p = getWorldTransform(ecs, parentId);
    if (!p) {
        return { x: localX, y: localY, rotation: localRotation, scaleX: localScaleX, scaleY: localScaleY };
    }

    const rad = p.rotation * DEG_TO_RAD;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const sx = localX * p.scaleX;
    const sy = localY * p.scaleY;

    return {
        x: p.x + sx * cos - sy * sin,
        y: p.y + sx * sin + sy * cos,
        rotation: p.rotation + localRotation,
        scaleX: p.scaleX * localScaleX,
        scaleY: p.scaleY * localScaleY,
    };
}

export function getWorldPosition(ecs: ECSInstance, entity: Entity | EntityComponents): { x: number; y: number } | null {
    const w = getWorldTransform(ecs, entity);
    return w ? { x: w.x, y: w.y } : null;
}

export function getWorldRotation(ecs: ECSInstance, entity: Entity | EntityComponents): number {
    const w = getWorldTransform(ecs, entity);
    return w ? w.rotation : 0;
}

export function getWorldScale(ecs: ECSInstance, entity: Entity | EntityComponents): { scaleX: number; scaleY: number } | null {
    const w = getWorldTransform(ecs, entity);
    return w ? { scaleX: w.scaleX, scaleY: w.scaleY } : null;
}

export function setTransform(ecs: ECSInstance, entity: Entity, transform: Partial<Transform & { parent?: string }>): void {
    const existing = getTransformComponent(ecs, entity);
    if (existing) {
        if (transform.x !== undefined) existing.x = transform.x;
        if (transform.y !== undefined) existing.y = transform.y;
        if (transform.rotation !== undefined) existing.rotation = transform.rotation;
        if (transform.scaleX !== undefined) existing.scaleX = transform.scaleX;
        if (transform.scaleY !== undefined) existing.scaleY = transform.scaleY;
        if ('parent' in transform) {
            if (transform.parent !== undefined) {
                existing.parent = transform.parent;
            } else {
                delete existing.parent;
            }
        }
    } else {
        getEntity(ecs, entity).transform = {
            type: "transform",
            parent: transform.parent,
            x: transform.x ?? 0,
            y: transform.y ?? 0,
            rotation: transform.rotation ?? 0,
            scaleX: transform.scaleX ?? 1,
            scaleY: transform.scaleY ?? 1,
        } as TransformComponent;
    }
}

export function setWorldPosition(ecs: ECSInstance, entity: Entity, worldX: number, worldY: number): void {
    const t = getTransformComponent(ecs, entity);
    const parentId = t?.parent;

    if (!parentId) {
        setTransform(ecs, entity, { x: worldX, y: worldY });
        return;
    }

    const p = getWorldTransform(ecs, parentId);
    if (!p) {
        console.warn(`Cannot set world position: parent entity "${parentId}" has no transform`);
        return;
    }

    if (p.scaleX === 0 || p.scaleY === 0) {
        console.warn("Cannot set world position: parent has zero scale");
        return;
    }

    const rx = worldX - p.x;
    const ry = worldY - p.y;
    const rad = p.rotation * DEG_TO_RAD;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    setTransform(ecs, entity, {
        x: (rx * cos + ry * sin) / p.scaleX,
        y: (-rx * sin + ry * cos) / p.scaleY,
    });
}

export function setWorldTransform(ecs: ECSInstance, entity: Entity, worldTransform: Transform, overrideParent?: Entity | null): void {
    const t = getTransformComponent(ecs, entity);
    const parentId = overrideParent !== undefined ? overrideParent : t?.parent;

    if (!parentId) {
        setTransform(ecs, entity, worldTransform);
        return;
    }

    const p = getWorldTransform(ecs, parentId);
    if (!p) {
        console.warn(`Cannot set world transform: parent entity "${parentId}" has no transform`);
        return;
    }

    if (p.scaleX === 0 || p.scaleY === 0) {
        console.warn("Cannot set world transform: parent has zero scale");
        return;
    }

    const rx = worldTransform.x - p.x;
    const ry = worldTransform.y - p.y;
    const rad = p.rotation * DEG_TO_RAD;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    setTransform(ecs, entity, {
        x: (rx * cos + ry * sin) / p.scaleX,
        y: (-rx * sin + ry * cos) / p.scaleY,
        rotation: worldTransform.rotation - p.rotation,
        scaleX: worldTransform.scaleX / p.scaleX,
        scaleY: worldTransform.scaleY / p.scaleY,
        parent: parentId,
    });
}

export function setParent(ecs: ECSInstance, entity: Entity, parentId: Entity | null): void {
    let cw = getWorldTransform(ecs, entity);
    if (!cw) {
        setTransform(ecs, entity, { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 });
        cw = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
    }

    if (parentId) {
        const pt = getTransformComponent(ecs, parentId);
        if (!pt) {
            console.warn(`Cannot reparent: parent entity "${parentId}" has no transform component`);
            return;
        }
    }

    if (!parentId) {
        setTransform(ecs, entity, { ...cw, parent: undefined });
        return;
    }

    const p = getWorldTransform(ecs, parentId);
    if (!p) {
        console.warn(`Cannot reparent: parent entity "${parentId}" has no world transform`);
        return;
    }

    if (p.scaleX === 0 || p.scaleY === 0) {
        console.warn("Cannot reparent: parent has zero scale");
        return;
    }

    const rx = cw.x - p.x;
    const ry = cw.y - p.y;
    const rad = p.rotation * DEG_TO_RAD;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    setTransform(ecs, entity, {
        x: (rx * cos + ry * sin) / p.scaleX,
        y: (-rx * sin + ry * cos) / p.scaleY,
        rotation: cw.rotation - p.rotation,
        scaleX: cw.scaleX / p.scaleX,
        scaleY: cw.scaleY / p.scaleY,
        parent: parentId,
    });
}

export function getChildren(ecs: ECSInstance, entity: Entity): Entity[] {
    const children: Entity[] = [];
    const entities = ecs.entities;
    for (const childId in entities) {
        const t = entities[childId].transform as TransformComponent | undefined;
        if (t?.parent === entity) {
            children.push(childId);
        }
    }
    return children;
}

export function getParents(ecs: ECSInstance, entity: Entity): Entity[] {
    const parents: Entity[] = [];
    let current: Entity | undefined = entity;

    while (current) {
        const t = getTransformComponent(ecs, current);
        const pid = t?.parent;
        if (!pid) break;
        parents.push(pid);
        current = pid;
    }

    return parents;
}

export function moveEntityAndParents(ecs: ECSInstance, entity: Entity, worldDeltaX: number, worldDeltaY: number): void {
    const parents = getParents(ecs, entity);
    const root = parents.length > 0 ? parents[parents.length - 1] : entity;
    const pos = getWorldPosition(ecs, root);
    if (!pos) return;
    setWorldPosition(ecs, root, pos.x + worldDeltaX, pos.y + worldDeltaY);
}

export function worldDirectionToLocal(ecs: ECSInstance, entity: Entity, worldDirX: number, worldDirY: number): { x: number; y: number } {
    const t = getTransformComponent(ecs, entity);
    const parentId = t?.parent;

    if (!parentId) return { x: worldDirX, y: worldDirY };

    const p = getWorldTransform(ecs, parentId);
    if (!p) return { x: worldDirX, y: worldDirY };

    const rad = p.rotation * DEG_TO_RAD;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const lx = worldDirX * cos + worldDirY * sin;
    const ly = -worldDirX * sin + worldDirY * cos;

    const avg = (p.scaleX + p.scaleY) * 0.5;
    if (avg === 0) return { x: lx, y: ly };

    return { x: lx / avg, y: ly / avg };
}

export function worldDistanceToLocal(ecs: ECSInstance, entity: Entity, worldDistance: number): number {
    const t = getTransformComponent(ecs, entity);
    const parentId = t?.parent;

    if (!parentId) return worldDistance;

    const p = getWorldTransform(ecs, parentId);
    if (!p) return worldDistance;

    const avg = (p.scaleX + p.scaleY) * 0.5;
    return avg === 0 ? worldDistance : worldDistance / avg;
}
