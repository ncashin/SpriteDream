export function definePlugin<
  TOptions = unknown,
  TRequired = object,
  TAdd = unknown,
>(
  factory: (options?: TOptions) => (input: TRequired) => TRequired & TAdd,
): (options?: TOptions) => (input: TRequired) => TRequired & TAdd {
  return factory;
}
