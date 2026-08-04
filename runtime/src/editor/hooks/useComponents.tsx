import { useSyncExternalStore } from "react";
import { getComponents, subscribeToComponents } from "../../tomove/components";

export const useComponents = () => useSyncExternalStore(subscribeToComponents, getComponents);
