import { Move, RotateCw, Maximize2 } from "lucide-react";
import { useState } from "react";

export type TransformMode = "translate" | "rotate" | "scale";

const modes: { id: TransformMode; icon: typeof Move }[] = [
  { id: "translate", icon: Move },
  { id: "rotate", icon: RotateCw },
  { id: "scale", icon: Maximize2 },
];

export const TransformModeWidget = () => {
  const [mode, setMode] = useState<TransformMode>("translate");

  return (
    <div className="flex flex-row gap-2">
      {modes.map(({ id, icon: Icon }) => (
        <button
          key={id}
          type="button"
          title={id}
          className={`flex flex-row items-center justify-center px-2.5 py-1 min-h-6 rounded-md text-xs transform-gizmo-btn ${mode === id ? "is-selected" : ""}`}
          onClick={() => setMode(id)}
        >
          <Icon size={12} strokeWidth={1.5} />
        </button>
      ))}
    </div>
  );
};
