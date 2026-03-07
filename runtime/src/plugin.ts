export function definePlugin<TOptions, TIn, TOut extends TIn>(
  factory: (options?: TOptions) => (input: TIn) => TOut,
): (options?: TOptions) => (input: TIn) => TOut {
  return factory;
}
