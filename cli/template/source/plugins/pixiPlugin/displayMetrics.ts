export function getDevicePixelRatio(): number {
  const dpr = globalThis.devicePixelRatio;
  return typeof dpr === "number" && Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
}

/**
 * Notifies when the device pixel ratio changes (e.g. moving a window between monitors).
 */
export function subscribeDevicePixelRatioChange(
  listener: (devicePixelRatio: number) => void,
): () => void {
  let current = getDevicePixelRatio();
  let mediaQuery: MediaQueryList | null = null;

  const attach = (): void => {
    mediaQuery?.removeEventListener("change", onChange);
    mediaQuery = globalThis.matchMedia(`(resolution: ${current}dppx)`);
    mediaQuery.addEventListener("change", onChange);
  };

  const onChange = (): void => {
    const next = getDevicePixelRatio();
    if (next === current) {
      attach();
      return;
    }
    current = next;
    listener(next);
    attach();
  };

  attach();

  return () => {
    mediaQuery?.removeEventListener("change", onChange);
  };
}
