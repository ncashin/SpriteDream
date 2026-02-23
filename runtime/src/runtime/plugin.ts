export type GameContext = {};

export type Plugin = (context: GameContext) => GameContext;

export type PluginFactory<TOptions = void> = (
  options?: TOptions
) => Plugin;

export type RequirePlugins<P extends readonly Plugin[]> = readonly [...P];

export const examplePlugin = (options?: { prefix?: string }) => (
  ctx: GameContext
) => ({
  ...ctx,
  example: {
    greet: () => `${options?.prefix ?? "Hello"} from example plugin`,
  },
});
