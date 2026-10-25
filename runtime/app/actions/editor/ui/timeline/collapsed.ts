const COLLAPSED_KEY = "timeline-collapsed";

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

export function isTimelineCollapsed() {
  return collapsed;
}

export function setTimelineCollapsed(next: boolean) {
  collapsed = next;
  try {
    localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
  } catch {
    // Storage can be unavailable in private browsing.
  }
  for (const listener of listeners) listener();
}

export function onTimelineCollapsedChange(listener: () => void, signal?: AbortSignal) {
  listeners.add(listener);
  signal?.addEventListener("abort", () => listeners.delete(listener));
}
