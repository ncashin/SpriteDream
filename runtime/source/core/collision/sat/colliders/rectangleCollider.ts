import type { Vector } from "../../../vector";
import { create, add, sub, dot } from "../../../vector";
import { getWorldTransform } from "../../../transform";
import { getCollisionPosition, getEntityCollider } from "../accessors";
import type { ColliderDefinition } from "../types";

export const RECTANGLE_COLLIDER: ColliderDefinition = {
    name: "rectangle",
    getNormals: (ecs, entity, _other) => {
        const collider = getEntityCollider(ecs, entity);
        const worldTransform = getWorldTransform(ecs, entity);
        const colliderAngle = (collider?.angle ?? 0) * Math.PI / 180;
        const transformAngle = worldTransform ? (worldTransform.rotation * Math.PI) / 180 : 0;
        const totalAngle = colliderAngle + transformAngle;
        const cos = Math.cos(totalAngle);
        const sin = Math.sin(totalAngle);

        const rotateVector = (v: Vector) =>
            create(v[0] * cos - v[1] * sin, v[0] * sin + v[1] * cos);

        return [rotateVector(create(0, 1)), rotateVector(create(1, 0))];
    },

    getClosestPoint: (ecs, entity, point) => {
        const collider = getEntityCollider(ecs, entity);
        const center = getCollisionPosition(ecs, entity);
        if (!collider || !center) return point;

        const worldTransform = getWorldTransform(ecs, entity);
        const width = (collider.width ?? 32) * (worldTransform?.scaleX ?? 1);
        const height = (collider.height ?? 32) * (worldTransform?.scaleY ?? 1);
        const colliderAngle = (collider.angle ?? 0) * Math.PI / 180;
        const transformAngle = worldTransform ? (worldTransform.rotation * Math.PI) / 180 : 0;
        const totalAngle = colliderAngle + transformAngle;

        const localPoint = sub(point, center);
        const cos = Math.cos(-totalAngle);
        const sin = Math.sin(-totalAngle);

        const rotatedPoint = create(
            localPoint[0] * cos - localPoint[1] * sin,
            localPoint[0] * sin + localPoint[1] * cos
        );

        const hw = width / 2;
        const hh = height / 2;
        const clampedX = Math.max(-hw, Math.min(hw, rotatedPoint[0]));
        const clampedY = Math.max(-hh, Math.min(hh, rotatedPoint[1]));

        const localClamped = create(clampedX, clampedY);
        const cos2 = Math.cos(totalAngle);
        const sin2 = Math.sin(totalAngle);

        const worldClamped = create(
            localClamped[0] * cos2 - localClamped[1] * sin2,
            localClamped[0] * sin2 + localClamped[1] * cos2
        );

        return add(center, worldClamped);
    },

    calculateProjection: (ecs, entity, normal) => {
        const collider = getEntityCollider(ecs, entity);
        const center = getCollisionPosition(ecs, entity);
        if (!collider || !center) return { min: 0, max: 0 };

        const worldTransform = getWorldTransform(ecs, entity);
        const width = (collider.width ?? 32) * (worldTransform?.scaleX ?? 1);
        const height = (collider.height ?? 32) * (worldTransform?.scaleY ?? 1);
        const colliderAngle = (collider.angle ?? 0) * Math.PI / 180;
        const transformAngle = worldTransform ? (worldTransform.rotation * Math.PI) / 180 : 0;
        const totalAngle = colliderAngle + transformAngle;

        const hw = width / 2;
        const hh = height / 2;

        const localCorners = [
            create(-hw, -hh),
            create(hw, -hh),
            create(hw, hh),
            create(-hw, hh),
        ];

        const cos = Math.cos(totalAngle);
        const sin = Math.sin(totalAngle);

        const corners = localCorners.map((localCorner) => {
            const worldCorner = create(
                localCorner[0] * cos - localCorner[1] * sin,
                localCorner[0] * sin + localCorner[1] * cos
            );
            return add(center, worldCorner);
        });

        const projections = corners.map((corner) => dot(corner, normal));
        return {
            min: Math.min(...projections),
            max: Math.max(...projections),
        };
    },

    debugDraw: (ecs, entity, context) => {
        const collider = getEntityCollider(ecs, entity);
        const center = getCollisionPosition(ecs, entity);
        if (!collider || !center) return;

        const worldTransform = getWorldTransform(ecs, entity);
        const width = (collider.width ?? 32) * (worldTransform?.scaleX ?? 1);
        const height = (collider.height ?? 32) * (worldTransform?.scaleY ?? 1);
        const colliderAngle = (collider.angle ?? 0) * Math.PI / 180;
        const transformAngle = worldTransform ? (worldTransform.rotation * Math.PI) / 180 : 0;
        const totalAngle = colliderAngle + transformAngle;

        context.save();
        context.strokeStyle = "#ff0000";
        context.lineWidth = 2;

        context.translate(center[0], center[1]);
        context.rotate(totalAngle);

        context.strokeRect(-width / 2, -height / 2, width, height);
        context.restore();
    },
};

