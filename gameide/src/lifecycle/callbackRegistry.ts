export type DisposeFunction = () => void;

export function createCallbackRegistry<
  CallbackType extends (...args: any[]) => any,
>() {
  const callbackList: CallbackType[] = [];

  function registerCallback(callbackFunction: CallbackType): DisposeFunction {
    callbackList.push(callbackFunction);

    return () => {
      const callbackIndex = callbackList.indexOf(callbackFunction);
      if (callbackIndex !== -1) {
        callbackList.splice(callbackIndex, 1);
      }
    };
  }

  function runCallbacks(...argumentList: Parameters<CallbackType>): void {
    for (const callbackFunction of callbackList) callbackFunction(...argumentList);
  }

  function clearCallbacks(): void {
    callbackList.length = 0;
  }

  return {
    register: registerCallback,
    run: runCallbacks,
    clear: clearCallbacks,
    get callbacks(): readonly CallbackType[] {
      return callbackList;
    },
  };
}
