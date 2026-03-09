export type DisposeFunction = () => void;

export type CallbackRegistryOptions<T extends (...args: any[]) => any> = {
  getCurrentScope?: () => string | undefined;
};

export function createCallbackRegistry<
  CallbackType extends (...args: any[]) => any,
>(options: CallbackRegistryOptions<CallbackType> = {}) {
  const callbackList: CallbackType[] = [];
  const callbackToScopeMap = new Map<CallbackType, string>();
  const { getCurrentScope } = options;

  function registerCallback(callbackFunction: CallbackType): DisposeFunction {
    callbackList.push(callbackFunction);
    if (getCurrentScope) {
      const scopeValue = getCurrentScope();
      if (scopeValue !== undefined) {
        callbackToScopeMap.set(callbackFunction, scopeValue);
      }
    }

    if (import.meta.hot) {
      const hotData = import.meta.hot.data;
      if (!hotData.callbackArrays) hotData.callbackArrays = [];
      hotData.callbackArrays.push({ list: callbackList, callback: callbackFunction });

      import.meta.hot.dispose(() => {
        for (const entry of hotData.callbackArrays!) {
          const index = entry.list.indexOf(entry.callback);
          if (index !== -1) entry.list.splice(index, 1);
        }
      });
    }

    return () => {
      const callbackIndex = callbackList.indexOf(callbackFunction);
      if (callbackIndex !== -1) {
        callbackList.splice(callbackIndex, 1);
        callbackToScopeMap.delete(callbackFunction);
      }
    };
  }

  function runCallbacks(...argumentList: Parameters<CallbackType>): void {
    for (const callbackFunction of callbackList) callbackFunction(...argumentList);
  }

  function runCallbacksAndCollectResults(...argumentList: Parameters<CallbackType>): ReturnType<CallbackType>[] {
    return callbackList.map((callbackFunction) => callbackFunction(...argumentList) as ReturnType<CallbackType>);
  }

  function removeCallbacksForScope(scopeValue: string): void {
    const callbacksToRemove: CallbackType[] = [];
    for (const [callbackFunction, scope] of callbackToScopeMap) {
      if (scope === scopeValue) callbacksToRemove.push(callbackFunction);
    }
    for (const callbackFunction of callbacksToRemove) {
      const callbackIndex = callbackList.indexOf(callbackFunction);
      if (callbackIndex !== -1) callbackList.splice(callbackIndex, 1);
      callbackToScopeMap.delete(callbackFunction);
    }
  }

  return {
    register: registerCallback,
    run: runCallbacks,
    runAndCollect: runCallbacksAndCollectResults,
    removeScope: removeCallbacksForScope,
    get callbacks(): readonly CallbackType[] {
      return callbackList;
    },
  };
}
