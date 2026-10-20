export const SIDEBAR_WIDTH = "20rem";
export const SIDEBAR_MOTION = "200ms cubic-bezier(0.4, 0, 0.2, 1)";

const COLLAPSED_KEY = "sidebar-collapsed";

function readStored() {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

let collapsed = readStored();

const listeners = new Set<() => void>();

export function isCollapsed() {
  return collapsed;
}

export function setCollapsed(next: boolean) {
  collapsed = next;
  try {
    localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
  } catch {
    // Storage can be unavailable in private browsing.
  }
  for (const listener of listeners) listener();
}

export function onCollapsedChange(listener: () => void, signal?: AbortSignal) {
  listeners.add(listener);
  signal?.addEventListener("abort", () => listeners.delete(listener));
}
