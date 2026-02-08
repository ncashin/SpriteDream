export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export const isDevelopment =
  typeof import.meta !== "undefined" &&
  import.meta.env &&
  import.meta.env.DEV;

type EditorModeWindow = Window & {
  __EDITOR_MODE_ENABLED__?: boolean;
};

const resolveEditorModeFlag = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }

  const typedWindow = window as EditorModeWindow;
  if (typeof typedWindow.__EDITOR_MODE_ENABLED__ === "boolean") {
    return typedWindow.__EDITOR_MODE_ENABLED__;
  }

  const isBuildTimeEditorEnabled =
    typeof import.meta !== "undefined" &&
    import.meta.env &&
    (import.meta.env.VITE_EDITOR_ENABLED === true ||
      import.meta.env.VITE_EDITOR_ENABLED === "true");

  typedWindow.__EDITOR_MODE_ENABLED__ =
    Boolean(isBuildTimeEditorEnabled) || Boolean(isDevelopment);

  return typedWindow.__EDITOR_MODE_ENABLED__;
};

// Unified check: is this running in editor mode?
// Use the single, cached window flag as the source of truth.
export const isEditorMode = (): boolean => resolveEditorModeFlag();