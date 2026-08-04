import { useSyncExternalStore } from "react";
import { z } from "zod";

type ObjectSchema = z.ZodObject<z.ZodRawShape>;

export interface ComponentDefinition<Schema extends ObjectSchema = ObjectSchema> {
  name: string;
  schema: Schema;
  defaults: Partial<z.input<Schema>>;
}

let components: ComponentDefinition[] = [];

const listeners = new Set<() => void>();

const emit = () => {
  listeners.forEach((listener) => listener());
};

export const subscribeToComponents = (listener: () => void) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};

export const getComponents = () => components;

export const useComponents = () =>
  useSyncExternalStore(subscribeToComponents, getComponents, getComponents);

export function defineComponent<const Name extends string, Schema extends ObjectSchema>(
  name: Name,
  schema: Schema,
  defaults: Partial<z.input<Schema>> = {},
) {
  const component = {
    name,
    schema,
    defaults,
  } satisfies ComponentDefinition<Schema>;

  components = [...components, component];
  emit();

  return component;
}

export function addComponent<Schema extends ObjectSchema>(
  target: Record<string, unknown>,
  component: ComponentDefinition<Schema>,
  values: Partial<z.input<Schema>> = {},
): z.output<Schema> {
  const result = component.schema.parse({
    ...component.defaults,
    ...target,
    ...values,
  });

  Object.assign(target, result);

  return result;
}

export function hasComponent<Schema extends ObjectSchema>(
  object: unknown,
  component: ComponentDefinition<Schema>,
): object is z.output<Schema> {
  return component.schema.safeParse(object).success;
}

export type ComponentType<T extends readonly ComponentDefinition[]> = T extends readonly [
  infer Head extends ComponentDefinition,
  ...infer Tail extends ComponentDefinition[],
]
  ? z.output<Head["schema"]> & ComponentType<Tail>
  : unknown;
