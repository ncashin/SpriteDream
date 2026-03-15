export function definePlugin<
  TOptions = unknown,
  TInput = object,
  TOutput extends TInput = TInput,
>(
  factory: (options?: TOptions) => (input: TInput) => TOutput | Promise<TOutput>,
): (options?: TOptions) => (input: TInput) => TOutput | Promise<TOutput> {
  return factory;
}
