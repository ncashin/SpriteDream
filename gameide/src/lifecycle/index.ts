export {
  gameide,
  getGameContext,
  type GameConfig,
  type GameContext,
  type DisposeCallback,
  type GameAPI,
} from "./initialization.js";
export { plugins, type ApplyPlugins, type Plugin } from "./plugin.js";
export {
  __beginHotModule,
  __endHotModule,
  __disposeHotModule,
  __runHotModuleReplay,
  __runModeStarts,
  __hotModuleDefaultExport,
  __hotModuleLastArgsForScope,
} from "./gameloop.js";
