export type VirtualCatalogId = "assets" | "scenes";

export type VirtualCatalogs = {
  readonly assets: readonly string[];
  readonly scenes: readonly string[];
};

const EMPTY_CATALOGS: VirtualCatalogs = { assets: [], scenes: [] };

let catalogs: VirtualCatalogs = EMPTY_CATALOGS;
const listeners = new Set<() => void>();
let loadPromise: Promise<void> | null = null;
let hmrRegistered = false;

function parseCatalogs(mod: { default: unknown }): VirtualCatalogs {
  const data = mod.default;
  if (!data || typeof data !== "object") return EMPTY_CATALOGS;

  const record = data as Record<string, unknown>;
  const parseList = (value: unknown): string[] =>
    Array.isArray(value)
      ? value.filter((entry): entry is string => typeof entry === "string")
      : [];

  return {
    assets: parseList(record.assets),
    scenes: parseList(record.scenes),
  };
}

function setCatalogs(next: VirtualCatalogs): void {
  catalogs = next;
  for (const listener of listeners) listener();
}

function registerCatalogHMR(): void {
  if (!import.meta.hot || hmrRegistered) return;
  hmrRegistered = true;

  import.meta.hot.accept("gameide:assets", (next) => {
    if (!next) return;
    setCatalogs(parseCatalogs(next));
  });
}

export async function loadVirtualCatalogs(): Promise<void> {
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      const mod = await import("gameide:assets");
      setCatalogs(parseCatalogs(mod));
    } catch {
      setCatalogs(EMPTY_CATALOGS);
    }
    registerCatalogHMR();
  })();

  return loadPromise;
}

export function getVirtualCatalogs(): VirtualCatalogs {
  return catalogs;
}

export function getVirtualCatalog(id: VirtualCatalogId): readonly string[] {
  return catalogs[id];
}

export function subscribeVirtualCatalogs(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
