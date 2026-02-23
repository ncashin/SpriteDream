import type { InputDisplayComponent } from "./types";
import { StringInput } from "./StringInput";
import { NumberInput } from "./NumberInput";
import { BooleanInput } from "./BooleanInput";
import { ObjectInput } from "./ObjectInput";

export const displayComponents: Record<string, InputDisplayComponent> = {
  string: StringInput,
  number: NumberInput,
  boolean: BooleanInput,
  object: ObjectInput,
};

export type { InputDisplayProps, InputDisplayComponent } from "./types";
export { StringInput } from "./StringInput";
export { NumberInput } from "./NumberInput";
export { BooleanInput } from "./BooleanInput";
export { ObjectInput } from "./ObjectInput";
