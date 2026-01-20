import { isEditorUpdateEnabled } from './gameloop';

export function addStartCallback(callback: () => void): void {
  if (isEditorUpdateEnabled()) return;
  callback();
}

export function addEditorStartCallback(callback: () => void): void {
  if (
    !isEditorUpdateEnabled() ||
    !(typeof import.meta !== "undefined" && import.meta.env && import.meta.env.DEV)
  ) return;
  callback();
}
