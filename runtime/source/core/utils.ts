export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export const isDevelopment =
  typeof import.meta !== "undefined" &&
  import.meta.env &&
  import.meta.env.DEV;

// Unified check: is this running in editor mode?
// Checks both build-time (VITE_EDITOR_ENABLED) and runtime (window.__EDITOR_MODE_ENABLED__) flags
export const isEditorMode = (): boolean => {
  // Check for build-time editor mode (set via VITE_EDITOR_ENABLED)
  const isBuildTimeEditorEnabled =
    typeof import.meta !== "undefined" &&
    import.meta.env &&
    (import.meta.env.VITE_EDITOR_ENABLED === true ||
      import.meta.env.VITE_EDITOR_ENABLED === "true");

  // Check for runtime editor mode (set via window.__EDITOR_MODE_ENABLED__)
  const isRuntimeEditorModeEnabled =
    typeof window !== "undefined" &&
    (window as any).__EDITOR_MODE_ENABLED__ === true;

  return isBuildTimeEditorEnabled || isRuntimeEditorModeEnabled || isDevelopment;
};

// Legacy alias for backwards compatibility
export const isEditorModeEnabled = isEditorMode;