export type GameContext = {};

export type Plugin = (context: GameContext) => GameContext;

export type RequirePlugins<P extends readonly Plugin[]> = readonly [...P];

export const examplePlugin = (context: GameContext) => ({
  ...context,
  example: {
    greet: () => "Hello from example plugin",
  },
});
