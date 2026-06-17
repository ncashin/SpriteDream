import { __beginHotModule, __endHotModule, __disposeHotModule, __runHotModuleReplay, __runModeStarts, __hotModuleDefaultExport, __hotModuleLastArgsForScope, getGameContext, getMode } from "gameide";
const __gameideHotScope = __beginHotModule(import.meta.url);
const __gameideHotLastArgs = __hotModuleLastArgsForScope(__gameideHotScope);
__GAMEIDE_HOT_MODULE_BODY__
__endHotModule(__gameideHotScope);
if (import.meta.hot) {
  import.meta.hot.accept((mod) => {
    const replay = mod?.default;
    if (typeof replay !== "function") return;
    const args =
      __gameideHotLastArgs.kind === "called"
        ? __gameideHotLastArgs.args
        : [getGameContext()];
    __runHotModuleReplay(__gameideHotScope, () => replay.apply(undefined, args));
    __runModeStarts(getMode());
  });
  import.meta.hot.dispose(() => __disposeHotModule(__gameideHotScope));
}
