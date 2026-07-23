import { createContext } from "react";

export const ReadyContext = createContext<() => void>(() => {});
export default function ReadyProvider({
  onReady,
  children,
}: {
  onReady: () => void;
  children: React.ReactNode;
}) {
  return <ReadyContext.Provider value={onReady}>{children}</ReadyContext.Provider>;
}
