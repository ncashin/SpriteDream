import type { GameModule } from "../../lifecycle/gameModule.js";

const DEFAULT_STORAGE_KEY = "gameide.save";

export type SaveGameAPI<T extends Record<string, unknown>> = {
  data: T;
  save: (data?: T) => void;
  reset: () => void;
};

function cloneData<T>(data: T): T {
  return structuredClone(data);
}

function loadSaveData<T extends Record<string, unknown>>(
  storageKey: string,
  defaultData: T,
): T {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw === null) return cloneData(defaultData);

    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return { ...cloneData(defaultData), ...(parsed as Partial<T>) };
    }
  } catch {
    // Ignore invalid or unavailable storage.
  }

  return cloneData(defaultData);
}

export default function saveGameModule<T extends Record<string, unknown>>(
  defaultData: T,
  key: string = DEFAULT_STORAGE_KEY,
): GameModule<{}, { saveGame: SaveGameAPI<T> }> {
  return (context) => {
    let data = loadSaveData(key, defaultData);

    function save(nextData: T = data): void {
      data = cloneData(nextData);
      localStorage.setItem(key, JSON.stringify(data));
    }

    function reset(): void {
      data = cloneData(defaultData);
      localStorage.removeItem(key);
    }

    const saveGame: SaveGameAPI<T> = {
      get data() {
        return data;
      },
      save,
      reset,
    };

    return {
      ...context,
      saveGame,
    };
  };
}
