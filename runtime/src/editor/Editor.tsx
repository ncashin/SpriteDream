import { Cog, PlayIcon } from "lucide-react";
import { Game } from "./Game";
import { OverlayButton } from "./OverlayButton";
import { Sidebar } from "./Sidebar";
import { TransformModeWidget } from "./TransformModeWidget";

export const Editor = () => {
  return (
    <div className="grid grid-cols-[20rem_1fr] h-full w-full">
      <Sidebar />
      <div className="relative min-w-0 h-full w-full">
        <Game />
        <div className="absolute top-3.5 right-3.5 z-10 text-sm flex flex-row items-center gap-2">
          <TransformModeWidget />
          <OverlayButton text="Settings" icon={Cog} />
          <OverlayButton text="Run" icon={PlayIcon} />
        </div>
      </div>
    </div>
  );
};
