import type { ReactNode } from "react";

export function EditorRoot({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 pointer-events-auto flex h-full overflow-hidden">
      {children}
    </div>
  );
}

