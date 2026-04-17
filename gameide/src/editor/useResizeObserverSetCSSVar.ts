import { useLayoutEffect, type RefObject } from "react";

export function useResizeObserverSetCSSVar(
  containerRef: RefObject<HTMLElement | null>,
  cssCustomPropertyName: string,
  measuredElementSelector: string,
  effectDependencies: readonly unknown[],
): void {
  useLayoutEffect(() => {
    const containerElement = containerRef.current;
    if (!containerElement) return;

    const setCssVarFromMeasuredElement = () => {
      const measuredElement = containerElement.querySelector<HTMLElement>(
        measuredElementSelector,
      );
      if (!measuredElement) {
        containerElement.style.removeProperty(cssCustomPropertyName);
        return;
      }
      containerElement.style.setProperty(
        cssCustomPropertyName,
        `${measuredElement.getBoundingClientRect().height}px`,
      );
    };

    setCssVarFromMeasuredElement();
    const measuredElement = containerElement.querySelector<HTMLElement>(
      measuredElementSelector,
    );
    if (!measuredElement) return;

    const resizeObserver = new ResizeObserver(setCssVarFromMeasuredElement);
    resizeObserver.observe(measuredElement);
    return () => {
      resizeObserver.disconnect();
      containerElement.style.removeProperty(cssCustomPropertyName);
    };
  }, [
    containerRef,
    cssCustomPropertyName,
    measuredElementSelector,
    ...effectDependencies,
  ]);
}
