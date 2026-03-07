import { startGameloop } from "./gameloop";

/** A plugin receives the current context (from initialContext or the previous plugin) and returns the context for the next plugin or main. */
export type Plugin<T> = (input: T) => T;

/** Infers the final context type after running the plugin chain. Each plugin's return value is the next plugin's input. */
type PipelineResult<TInitial, P> = P extends readonly [(input: TInitial) => infer TOut, ...infer Rest]
  ? Rest extends readonly ((input: any) => any)[]
    ? PipelineResult<TOut, Rest>
    : TOut
  : TInitial;

export type InitializeGameOptions<
  TInitial = unknown,
  TPlugins extends readonly ((input: any) => any)[] = readonly []
> = {
  /** Plugins run in order; each receives the context returned by the previous (or initialContext for the first). */
  plugins?: TPlugins;
  initialContext: TInitial;
  main: (gameContext: PipelineResult<TInitial, TPlugins>) => void;
};

function initializeGame<TInitial, const TPlugins extends readonly [(input: any) => any, ...((input: any) => any)[]]>(
  options: {
    initialContext: TInitial;
    plugins: TPlugins;
    main: (gameContext: PipelineResult<TInitial, TPlugins>) => void;
  }
): void;
function initializeGame<T>(options: {
  initialContext: T;
  main: (gameContext: T) => void;
}): void;
function initializeGame<TInitial, TPlugins extends readonly ((input: any) => any)[]>(
  options: InitializeGameOptions<TInitial, TPlugins>
): void {
  let result: any = options.initialContext;
  if (Array.isArray(options.plugins)) {
    for (const plugin of options.plugins) {
      if (typeof plugin === "function") {
        result = plugin(result);
      }
    }
  }

  options.main(result);

  startGameloop();
}

export { initializeGame };
