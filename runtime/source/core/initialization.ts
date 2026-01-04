import { isEditorEnabled } from './gameloop';

/**
 * Executes the callback if the editor is NOT running
 */
export function addStartCallback(callback: () => void): void {
  if (isEditorEnabled()) return;
  callback();
}

/**
 * Executes the callback if the editor IS running
 */
export function addEditorStartCallback(callback: () => void): void {
  if (!isEditorEnabled()) return;
  callback();
}
