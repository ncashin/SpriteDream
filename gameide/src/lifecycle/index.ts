export {
  gameide,
  type GameConfig,
  type GameContext,
  type DisposeCallback,
  type GameAPI,
} from "./game.js";
export { plugins, type ApplyPlugins, type Plugin } from "./plugin.js";
export {
  __beginHotModule,
  __endHotModule,
  __disposeHotModule,
} from "./gameloop.js";
