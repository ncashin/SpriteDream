import { startGameloop } from "./gameloop";

export type Plugin<T> = (input: T) => T;

export type InitializeGameOptions<T = unknown> = {
  plugins?: Plugin<T>[];
  initialContext?: T;
  main: (gameContext: T) => void;
};

export const initializeGame = <T = unknown>(options: InitializeGameOptions<T>): void => {
  let result = (options.initialContext ?? {}) as T;
  if (Array.isArray(options.plugins)) {
    for (const plugin of options.plugins) {
      if (typeof plugin === "function") {
        result = plugin(result);
      }
    }
  }

  options.main(result);

  startGameloop();
};
