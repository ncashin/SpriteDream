import { createContext } from "react";

export const GameViewContext = createContext<() => void>(() => {});
export default function GameViewReadyProvider({
  onReady,
  children,
}: {
  onReady: () => void;
  children: React.ReactNode;
}) {
  return <GameViewContext.Provider value={onReady}>{children}</GameViewContext.Provider>;
}
