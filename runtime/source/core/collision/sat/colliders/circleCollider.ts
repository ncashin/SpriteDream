import { add, dot, length, normalize, scale, sub } from "../../../vector";
import { getWorldTransform } from "../../../transform";
import { colliders } from "../registry";
import {
    getCollisionPosition,
    getEntityCollider,
    getEntityVelocity,
} from "../accessors";
import type { ColliderDefinition } from "../types";

export const CIRCLE_COLLIDER: ColliderDefinition = {
    name: "circle",
    getNormals: (ecs, entity, other) => {
        const position = getCollisionPosition(ecs, entity);
        if (!position) return [];

        const otherCollider = getEntityCollider(ecs, other);
        if (!otherCollider) return [];

        const otherColliderName = otherCollider.colliderName ?? "rectangle";
        const otherColliderDef = colliders[otherColliderName];
        if (!otherColliderDef) return [];

        const closestPoint = otherColliderDef.getClosestPoint(ecs, other, position);
        const direction = sub(closestPoint, position);
        if (length(direction) > 0) {
            return [normalize(direction)];
        }
        return [];
    },

    getClosestPoint: (ecs, entity, point) => {
        const position = getCollisionPosition(ecs, entity);
        const collider = getEntityCollider(ecs, entity);
        if (!position || !collider) return point;

        const worldTransform = getWorldTransform(ecs, entity);
        const baseRadius = collider.radius ?? 16;
        const scaleFactor = worldTransform
            ? Math.max(worldTransform.scaleX, worldTransform.scaleY)
            : 1;
        const radius = baseRadius * scaleFactor;
        const direction = sub(point, position);
        if (length(direction) <= radius) {
            return point;
        }
        return add(position, scale(normalize(direction), radius));
    },

    calculateProjection: (ecs, entity, normal) => {
        const position = getCollisionPosition(ecs, entity);
        const collider = getEntityCollider(ecs, entity);
        if (!position || !collider) return { min: 0, max: 0 };

        const worldTransform = getWorldTransform(ecs, entity);
        const baseRadius = collider.radius ?? 16;
        const scale = worldTransform
            ? Math.max(worldTransform.scaleX, worldTransform.scaleY)
            : 1;
        const radius = baseRadius * scale;
        const projection = dot(position, normal);
        return {
            min: projection - radius,
            max: projection + radius,
        };
    },

    debugDraw: (ecs, entity, context) => {
        const position = getCollisionPosition(ecs, entity);
        const collider = getEntityCollider(ecs, entity);
        const velocity = getEntityVelocity(ecs, entity);
        if (!position || !collider) return;

        const worldTransform = getWorldTransform(ecs, entity);
        const baseRadius = collider.radius ?? 16;
        const scale = worldTransform
            ? Math.max(worldTransform.scaleX, worldTransform.scaleY)
            : 1;
        const radius = baseRadius * scale;

        context.save();
        context.strokeStyle = "#ff0000";
        context.lineWidth = 2;

        context.beginPath();
        context.arc(position[0], position[1], radius, 0, Math.PI * 2);
        context.stroke();
        context.restore();

        if (velocity) {
            context.save();
            context.strokeStyle = "#00ff00";
            context.lineWidth = 2;
            context.beginPath();
            context.moveTo(position[0], position[1]);
            const scaleFactor = 0.1;
            context.lineTo(
                position[0] + velocity[0] * scaleFactor,
                position[1] + velocity[1] * scaleFactor
            );
            context.stroke();
            context.restore();
        }
    },
};

