import { curryScene, type Scene } from "./scene";

export type GameIDEOptions<AdditionalContext> = {
  rootElement: Element;
  initialScene: Scene;
  additionalContext: AdditionalContext;
};

export const curryRun =
  <Input extends object>(gameContext: Input) =>
  <Output extends object>(gameModule: (context: Input) => Output) => {
    const newContext = gameModule(gameContext);

    return { gameContext: newContext, run: curryRun(newContext) };
  };

export const gameide = <AdditionalContext>({
  rootElement,
  initialScene,
  additionalContext,
}: GameIDEOptions<AdditionalContext>) => {
  const scene = curryScene(initialScene);

  let gameContext = {
    rootElement,
    scene,
    ...additionalContext,
  };

  return { gameContext, run: curryRun(gameContext) };
};
