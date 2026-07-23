import { z } from "zod";

type ObjectSchema = z.ZodObject<z.ZodRawShape>;

export interface ComponentDefinition<Schema extends ObjectSchema = ObjectSchema> {
  name: string;
  schema: Schema;
}

export const definedComponents: ComponentDefinition[] = [];

export function defineComponent<const Name extends string, Schema extends ObjectSchema>(
  name: Name,
  schema: Schema,
) {
  const component = {
    name,
    schema,
  } satisfies ComponentDefinition<Schema>;

  definedComponents.push(component);

  return component;
}

export function addComponent<Schema extends ObjectSchema>(
  target: Record<string, unknown>,
  component: ComponentDefinition<Schema>,
  values: Partial<z.input<Schema>> = {},
): z.output<Schema> {
  const result = component.schema.parse({
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
