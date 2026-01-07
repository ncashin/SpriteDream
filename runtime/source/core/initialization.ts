import { isEditorEnabled } from './gameloop';

export function addStartCallback(callback: () => void): void {
  if (isEditorEnabled()) return;
  callback();
}

export function addEditorStartCallback(callback: () => void): void {
  if (
    !isEditorEnabled() ||
    !(typeof import.meta !== "undefined" && import.meta.env && import.meta.env.DEV)
  ) return;
  callback();
}
