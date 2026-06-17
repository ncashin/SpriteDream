import hotModuleTemplate from "../hotModuleTemplate.js?raw";
import { detectLifecycleHooks } from "./detectLifecycleHooks";
import { wrapHMRDefaultExport } from "./rewriteDefaultExport";

const transformableModulePattern = /\.[cm]?[jt]sx?$/;
const hotModuleBodyPlaceholder = "__GAMEIDE_HOT_MODULE_BODY__";

function createHotModuleCode(code: string): string {
  return hotModuleTemplate.replace(hotModuleBodyPlaceholder, code);
}

export function transformLifecycleHMR(
  code: string,
  id: string,
  isServe: boolean,
): { code: string; map: null } | undefined {
  if (!isServe) return;
  const filePath = id.replace(/\?.*$/, "");
  if (!transformableModulePattern.test(filePath)) return;
  if (filePath.includes("/node_modules/")) return;
  if (code.includes("__beginHotModule")) return;
  if (!detectLifecycleHooks(code, filePath)) return;

  const wrappedDefault = wrapHMRDefaultExport(code, id);

  return {
    code: createHotModuleCode(wrappedDefault ?? code),
    map: null,
  };
}
