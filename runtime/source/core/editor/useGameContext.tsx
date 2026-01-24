import { atom, useAtomValue, getDefaultStore } from "jotai";
import type { EntityComponents } from "../ecs/ecs";
import { undoRedoManager } from "./undoRedo";
import { clipboardManager } from "./clipboard";

export type GameContextType = Record<string, unknown>;

export const gameContextAtom = atom<GameContextType | null>(null);

export function setGameContext(context: GameContextType | null) {
    getDefaultStore().set(gameContextAtom, context);
}

export function useGameContext() {
    return useAtomValue(gameContextAtom);
}

export function startUndoAction() {
    undoRedoManager.startAction();
}

export function undo() {
    return undoRedoManager.undo();
}

export function redo() {
    return undoRedoManager.redo();
}

export function canUndo(): boolean {
    return undoRedoManager.canUndo();
}

export function canRedo(): boolean {
    return undoRedoManager.canRedo();
}

export function copyEntity(entityName: string, components: EntityComponents) {
    clipboardManager.copy(entityName, components);
}

export function pasteEntity(existingEntityNames: string[]) {
    return clipboardManager.paste(existingEntityNames);
}

export function hasClipboardData(): boolean {
    return clipboardManager.hasData();
}

