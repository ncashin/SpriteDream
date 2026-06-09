import { useEffect, useMemo, useState } from "react";

type CatalogId = "assets" | "scenes";

const CATALOG_IDS: readonly CatalogId[] = ["assets", "scenes"];

const catalogModules: Record<
  CatalogId,
  () => Promise<{ default: readonly string[] }>
> = {
  assets: () => import("gameide:assets"),
  scenes: () => import("gameide:scenes"),
};

const catalogState: Partial<Record<CatalogId, string[]>> = {};
const catalogListeners = new Set<() => void>();
const catalogLoads = new Map<CatalogId, Promise<void>>();

function notifyCatalogListeners() {
  for (const listener of catalogListeners) listener();
}

function setCatalog(id: CatalogId, items: string[]) {
  catalogState[id] = items;
  notifyCatalogListeners();
}

function parseCatalogItems(mod: { default: unknown }): string[] {
  return Array.isArray(mod.default)
    ? mod.default.filter((entry): entry is string => typeof entry === "string")
    : [];
}

let hmrRegistered = false;

function registerCatalogHmr() {
  if (!import.meta.hot || hmrRegistered) return;
  hmrRegistered = true;

  import.meta.hot.accept("gameide:assets", (next) => {
    if (!next) return;
    setCatalog("assets", parseCatalogItems(next));
  });

  import.meta.hot.accept("gameide:scenes", (next) => {
    if (!next) return;
    setCatalog("scenes", parseCatalogItems(next));
  });
}

async function ensureCatalogLoaded(id: CatalogId): Promise<void> {
  const existing = catalogLoads.get(id);
  if (existing) return existing;

  const load = (async () => {
    try {
      const mod = await catalogModules[id]();
      setCatalog(id, parseCatalogItems(mod));
    } catch {
      setCatalog(id, []);
    }
    registerCatalogHmr();
  })();

  catalogLoads.set(id, load);
  return load;
}

function useCatalog(id: CatalogId): string[] {
  const [items, setItems] = useState(catalogState[id] ?? []);

  useEffect(() => {
    void ensureCatalogLoaded(id);
    const onUpdate = () => setItems(catalogState[id] ?? []);
    catalogListeners.add(onUpdate);
    onUpdate();
    return () => {
      catalogListeners.delete(onUpdate);
    };
  }, [id]);

  return items;
}

function mergeCatalogs(): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];

  for (const id of CATALOG_IDS) {
    for (const item of catalogState[id] ?? []) {
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
