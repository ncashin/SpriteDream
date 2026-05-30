import type { ViteDevServer } from "vite";

export const VIRTUAL_ASSETS_MODULE = "gameide:assets";
export const VIRTUAL_SCENES_MODULE = "gameide:scenes";

const virtualModulePrefix = "\0";

const virtualModuleInternalId: Record<string, string> = {
  [VIRTUAL_ASSETS_MODULE]: "gameide-assets",
  [VIRTUAL_SCENES_MODULE]: "gameide-scenes",
};

export function resolvedVirtualModuleId(publicId: string): string {
  const internal = virtualModuleInternalId[publicId] ?? publicId;
  return virtualModulePrefix + internal;
}

export function invalidateCatalogModules(server: ViteDevServer): void {
  for (const virtualId of [VIRTUAL_ASSETS_MODULE, VIRTUAL_SCENES_MODULE]) {
    const mod = server.moduleGraph.getModuleById(resolvedVirtualModuleId(virtualId));
    if (mod) server.moduleGraph.invalidateModule(mod);
  }
}
