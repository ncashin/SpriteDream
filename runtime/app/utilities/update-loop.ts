
export type FrameInfo = { deltaTime: number };
export type UpdateCallback = (frameInfo: FrameInfo) => void;

export type UpdateLoop = {
  start: () => void;
  stop: () => void;
  onUpdate: (listener: UpdateCallback) => UpdateCallback;
  removeUpdate: (listener: UpdateCallback) => void;
  listeners: Set<UpdateCallback>;
};

export const createUpdateLoop = (options?: { signal?: AbortSignal }): UpdateLoop => {
  const listeners = new Set<UpdateCallback>();
  let running = false;
  let lastTimestamp = 0;
  let frame = 0;

  const dispatch = (frameInfo: FrameInfo) => {
    for (const listener of listeners) {
      listener(frameInfo);
    }
  };

  const tick = (timestamp: number) => {
    const deltaTime = (timestamp - lastTimestamp) / 1000;
    lastTimestamp = timestamp;
    dispatch({ deltaTime });
    if (running) frame = requestAnimationFrame(tick);
  };

  const start = () => {
    if (running) return;
    running = true;
    lastTimestamp = performance.now();
    // Paint once before yielding. Client hydration is still in progress here,
    // so the client is not finished loading until this draw returns.
    dispatch({ deltaTime: 0 });
    if (running) frame = requestAnimationFrame(tick);
  };

  const stop = () => {
    running = false;
    if (!frame) return;
    cancelAnimationFrame(frame);
    frame = 0;
  };

  const onUpdate = (listener: UpdateCallback) => {
    listeners.add(listener);
    return listener;
  };

  const removeUpdate = (listener: UpdateCallback) => {
    listeners.delete(listener);
  };

  options?.signal?.addEventListener("abort", stop);

  return { start, stop, onUpdate, removeUpdate, listeners };
};