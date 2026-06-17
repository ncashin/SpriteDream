import { useMemo, useSyncExternalStore } from "react";
import {
  getVirtualCatalog,
  loadVirtualCatalogs,
  subscribeVirtualCatalogs,
  type VirtualCatalogId,
} from "gameide";

const CATALOG_IDS: readonly VirtualCatalogId[] = ["assets", "scenes"];

function useCatalog(id: VirtualCatalogId): readonly string[] {
  return useSyncExternalStore(
    (onStoreChange) => {
      void loadVirtualCatalogs();
      return subscribeVirtualCatalogs(onStoreChange);
    },
    () => getVirtualCatalog(id),
    () => getVirtualCatalog(id),
  );
}

function mergeCatalogs(): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];

  for (const id of CATALOG_IDS) {
    for (const item of getVirtualCatalog(id)) {
      if (seen.has(item)) continue;
      seen.add(item);
      merged.push(item);
    }
  }

  return merged.sort((a, b) => a.localeCompare(b));
}

export function useSuggestions(): readonly string[] {
  const assets = useCatalog("assets");
  const scenes = useCatalog("scenes");

  return useMemo(() => mergeCatalogs(), [assets, scenes]);
}
