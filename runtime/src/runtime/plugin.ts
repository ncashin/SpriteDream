declare global {
  interface Window {
    __isRunning: boolean;
  }
}

export type GameContext = {
  __gameRoot: HTMLElement;
};

export type Plugin<TContext extends GameContext = GameContext> = (
  context: GameContext
) => TContext | Promise<TContext>;

export type PluginFactory<TOptions = void, TContext extends GameContext = GameContext> = (
  options?: TOptions
) => Plugin<TContext>;

export type RequirePlugins<P extends readonly Plugin[]> = readonly [...P];

export const examplePlugin = (options?: { prefix?: string }) => (
  ctx: GameContext
) => ({
  ...ctx,
  example: {
    greet: () => `${options?.prefix ?? "Hello"} from example plugin`,
  },
});
