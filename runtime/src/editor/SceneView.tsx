import { SlidersHorizontal } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import type { Scene } from "../scene/scene";
import { useScene } from "../scene/useScene";
import { cn } from "../utils/cn";
import { BooleanInput } from "./inputs";
import { Dropdown } from "./Dropdown";
import { IconButton } from "./IconButton";
import { ObjectDisplay } from "./ObjectDisplay";
import { setAtPath } from "./scenePath";
import { Searchbar } from "./Searchbar";

export type SceneViewProps = {
  scene?: Scene;
  onChange?: (path: string, value: unknown) => void;
};

export const SceneView = ({
  scene: sceneProp,
  onChange: onChangeProp,
}: SceneViewProps) => {
  const [showHiddenProperties, setShowHiddenProperties] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const sceneFromStore = useScene();
  const scene = sceneProp ?? sceneFromStore;
  const onChange =
    onChangeProp ??
    ((path, value) => setAtPath(scene as Record<string, unknown>, path, value));

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClick);
    }
    return () => document.removeEventListener("mousedown", handleClick);
  }, [dropdownOpen]);

  return (
    <>
      <div className="pl-2.5 pb-2">
        <h1 className="font-bold text-dark-tx p-internal-sidebar">Scene View</h1>
      </div>

      <div
        ref={dropdownRef}
        className="relative px-2 pr-3.5 pb-1.5 text-sm text-dark-tx"
      >
        <Searchbar
          className="flex-1"
          rightAdornment={
            <div className="relative">
              <IconButton
                icon={SlidersHorizontal}
                onClick={() => setDropdownOpen((open) => !open)}
              />
              {dropdownOpen && (
                <Dropdown className="top-[140%] -right-1 mt-0.5 p-1.5 ">
                  <div className="text-dark-fg-muted flex items-center gap-1.5 p-0.5 min-w-max">
                    <BooleanInput
                      value={showHiddenProperties}
                      displayValue={showHiddenProperties}
                      onChange={(v) => setShowHiddenProperties(!!v)}
                      label="Show Hidden Properties"
                    />
                  </div>
                </Dropdown>
              )}
            </div>
          }
        />
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
          onChange={onChange}
        />
      </div>
    </>
  );
};
