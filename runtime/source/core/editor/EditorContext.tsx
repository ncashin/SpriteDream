import { atom, useAtomValue, getDefaultStore } from "jotai";
import type { Entity, EntityComponents } from "../ecs/ecs";
import { undoRedoManager } from "./undoRedo";
import { clipboardManager } from "./clipboard";

// ============================================================================
// Types
// ============================================================================

/** The full game context - dynamically built from plugins */
export type GameContextType = Record<string, unknown>;

export interface EntityState {
  /** All entity IDs */
  entities: Entity[];
  /** Currently selected entity */
  selectedEntity: Entity | null;
  /** Entity components by entity ID */
  entityComponents: Record<Entity, EntityComponents>;
  /** Version counter for forcing updates */
  version: number;
}

// ============================================================================
// Atoms
// ============================================================================

/** Atom holding the full game context */
export const gameContextAtom = atom<GameContextType | null>(null);

/** Setter for external code to update the game context */
export function setGameContext(context: GameContextType | null) {
  getDefaultStore().set(gameContextAtom, context);
}

/** Atom holding entity state */
export const entityStateAtom = atom<EntityState>({
  entities: [],
  selectedEntity: null,
  entityComponents: {},
  version: 0,
});

/** Derived atom for entity list */
export const entitiesAtom = atom((get) => get(entityStateAtom).entities);

/** Derived atom for selected entity */
export const selectedEntityAtom = atom((get) => get(entityStateAtom).selectedEntity);

/** Derived atom for entity components map */
export const entityComponentsAtom = atom((get) => get(entityStateAtom).entityComponents);

// ============================================================================
// Hooks
// ============================================================================

/** Hook to read the full game context */
export function useGameContext() {
  return useAtomValue(gameContextAtom);
}

/** Hook for reading entities list only (optimized - won't re-render on selection change) */
export function useSceneEntities() {
  return useAtomValue(entitiesAtom);
}

/** Hook for reading selected entity only */
export function useSelectedEntity() {
  return useAtomValue(selectedEntityAtom);
}

/** Hook for reading entity components map */
export function useEntityComponents() {
  return useAtomValue(entityComponentsAtom);
}

/** Hook to get components for a specific entity */
export function useEntityData(entity: Entity | null) {
  const entityComponents = useAtomValue(entityComponentsAtom);
  return entity ? entityComponents[entity] ?? {} : {};
}

/** Hook to check if an entity exists */
export function useIsEntityValid(entity: Entity | null) {
  const entities = useAtomValue(entitiesAtom);
  return entity !== null && entities.includes(entity);
}

// ============================================================================
// Undo/Redo Functions
// ============================================================================

/** Start a new undo/redo action (groups multiple diffs together) */
export function startUndoAction() {
  undoRedoManager.startAction();
}

/** Undo the last action */
export function undo() {
  return undoRedoManager.undo();
}

/** Redo the last undone action */
export function redo() {
  return undoRedoManager.redo();
}

/** Check if undo is available */
export function canUndo(): boolean {
  return undoRedoManager.canUndo();
}

/** Check if redo is available */
export function canRedo(): boolean {
  return undoRedoManager.canRedo();
}

// ============================================================================
// Clipboard Functions
// ============================================================================

/** Copy an entity to the clipboard */
export function copyEntity(entityName: string, components: EntityComponents) {
  clipboardManager.copy(entityName, components);
}

/** Paste an entity from the clipboard */
export function pasteEntity(existingEntityNames: string[]) {
  return clipboardManager.paste(existingEntityNames);
}

/** Check if clipboard has data */
export function hasClipboardData(): boolean {
  return clipboardManager.hasData();
}

