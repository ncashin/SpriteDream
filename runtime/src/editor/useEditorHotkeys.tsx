import { useHotkey } from "@tanstack/react-hotkeys";
import { useEffect } from "react";

export default function useEditorHotkeys({
  onSave,
  onUndo,
  onRedo,
  hasUnsavedChanges,
}: {
  onSave: () => void;
  onUndo: () => void;
  onRedo: () => void;
  hasUnsavedChanges: boolean;
}) {
  useHotkey("Mod+Z", (event) => {
    event.preventDefault();
    onUndo();
  });

  useHotkey("Mod+Shift+Z", (event) => {
    event.preventDefault();
    onRedo();
  });

  useHotkey("Mod+S", (event) => {
    event.preventDefault();
    if (hasUnsavedChanges) {
      onSave();
    }
  });

  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  const confirmFileChange = () => {
    if (!hasUnsavedChanges) return true;

    return window.confirm("You have unsaved changes. Are you sure you want to switch files?");
  };

  return { confirmFileChange };
}
