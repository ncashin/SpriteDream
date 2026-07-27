import type { Mesh } from "three";
import { z } from "zod";
import { defineComponent, type ComponentType } from "../components";
import type { TransformComponent } from "./transform";

export const MeshComponent = defineComponent(
  "mesh",
  z.object({
    visible: z.boolean(),
    geometry: z.string(),
    material: z.string(),
  }),
  {
    visible: true,
    geometry: "a",
    material: "a",
  },
);

export function syncMeshComponent(
  component: ComponentType<typeof TransformComponent> & ComponentType<typeof MeshComponent>,
  mesh: Mesh,
) {
  mesh.position.set(component.position.x, component.position.y, component.position.z);

  mesh.rotation.set(component.rotation.x, component.rotation.y, component.rotation.z);

  mesh.scale.set(component.scale.x, component.scale.y, component.scale.z);

  mesh.visible = component.visible;
}
