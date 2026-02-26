import type { ComponentType } from "react";
import { Cog, PlayIcon } from "lucide-react";

import { OverlayButton } from "./OverlayButton";
import { Sidebar } from "./Sidebar";
import { TransformModeWidget } from "./TransformModeWidget";

export type EditorProps = {
  Game: ComponentType;
};

export const Editor = ({ Game }: EditorProps) => {
  return (
    <div className="flex flex-row h-screen w-full min-h-0">
      <Sidebar />
      <div className="relative flex flex-1 min-w-0 min-h-0">
        <Game />
        <div className="absolute top-3.5 right-3.5 z-10 flex flex-row items-center gap-1  rounded-md bg-editor-background p-0.5">
          <TransformModeWidget />
          <OverlayButton text="Settings" icon={Cog} />
          <OverlayButton text="Run" icon={PlayIcon} />
        </div>
      </div>
    </div>
  );
};
