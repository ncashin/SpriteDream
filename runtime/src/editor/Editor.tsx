import { Cog, PlayIcon } from "lucide-react";
import { Game } from "./Game";
import { OverlayButton } from "./OverlayButton";
import { Sidebar } from "./Sidebar";
import { TransformModeWidget } from "./TransformModeWidget";

export const Editor = () => {
  return (
    <div className="flex flex-row h-full w-full">
      <Sidebar />
      <div className="relative grow h-full w-full">
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
