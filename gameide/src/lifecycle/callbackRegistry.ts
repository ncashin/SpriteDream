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

  function runCallbacksAndCollectResults(...argumentList: Parameters<CallbackType>): ReturnType<CallbackType>[] {
    return callbackList.map((callbackFunction) => callbackFunction(...argumentList) as ReturnType<CallbackType>);
  }

  return {
    register: registerCallback,
    run: runCallbacks,
    runAndCollect: runCallbacksAndCollectResults,
    get callbacks(): readonly CallbackType[] {
      return callbackList;
    },
  };
}
