import { PlayIcon } from "lucide-react";
import { Game } from "./Game";
import { OverlayButton } from "./OverlayButton";
import { Sidebar } from "./Sidebar";

export const Editor = () => {
  return (
    <div className="flex flex-row h-full w-full">
      <Sidebar />
      <div className="relative grow h-full w-full">
        <Game />
        <div className="absolute top-2 right-2 z-10 text-sm">
          <OverlayButton text="Run" icon={PlayIcon} />
        </div>
      </div>
    </div>
  );
};
