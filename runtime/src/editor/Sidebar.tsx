import { useState } from "react";
import { useScene } from "../scene/useScene";
import { cn } from "../utils/cn";
import { ObjectDisplay } from "./ObjectDisplay";
import { setAtPath } from "./scenePath";
import { Searchbar } from "./Searchbar";

export const Sidebar = () => {
  const scene = useScene();
  const [showHiddenProperties, setShowHiddenProperties] = useState(false);

  return (
    <div className="min-w-80 w-80 max-w-80 h-full pt-5.5 flex flex-col bg-dark-bg border border-dark-ui">

      
      <div className="pl-1.5 pb-2">
        <h1 className="font-bold text-dark-tx p-internal-sidebar">Scene View</h1>
      </div>

      <div className="px-2 pr-3.5 pb-1.5 text-sm text-dark-tx flex items-center gap-2">
        <Searchbar />
        <label className="flex items-center gap-1.5 whitespace-nowrap text-dark-fg-muted cursor-pointer">
          <input
            type="checkbox"
            checked={showHiddenProperties}
            onChange={(e) => setShowHiddenProperties(e.target.checked)}
            className="rounded border-dark-ui-2"
          />
          Show hidden
        </label>
      </div>

      <div
        className={cn(
          "overflow-x-auto h-full px-2 pb-8 text-sm text-dark-tx",
          `
            [&::-webkit-scrollbar]:h-1
            [&::-webkit-scrollbar-track]:bg-dark-ui-2
            [&::-webkit-scrollbar-thumb]:bg-light-ui-3
          `,
        )}
      >
        <ObjectDisplay
          scene={scene}
          showHiddenProperties={showHiddenProperties}
          onChange={(path, value) => setAtPath(scene as Record<string, unknown>, path, value)}
        />
      </div>
      
    </div>
  );
};
