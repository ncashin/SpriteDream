import { useSyncExternalStore } from "react";
import { getComponents, subscribeToComponents } from "../components";

export const useComponents = () => useSyncExternalStore(subscribeToComponents, getComponents);
