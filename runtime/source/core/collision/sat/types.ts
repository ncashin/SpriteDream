import type { ECSInstance, Entity } from "../../ecs/ecs";
import type { Vector } from "../../vector";

export type ColliderDefinition = {
    name: string;
    getNormals: (ecs: ECSInstance, entity: Entity, other: Entity) => Vector[];
    getClosestPoint: (ecs: ECSInstance, entity: Entity, point: Vector) => Vector;
    calculateProjection: (
        ecs: ECSInstance,
        entity: Entity,
        normal: Vector
    ) => { min: number; max: number };
    debugDraw?: (
        ecs: ECSInstance,
        entity: Entity,
        context: CanvasRenderingContext2D
    ) => void;
};

