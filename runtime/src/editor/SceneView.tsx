import { ChevronDown, ChevronRight, SlidersHorizontal } from "lucide-react";
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
  const [expanded, setExpanded] = useState(true);
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
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="mb-1.5 mt-1 w-full flex items-center gap-1 text-left text-sm font-medium text-dark-tx sidebar-padding rounded-md"
      >

        <span className="">Scene View</span>
        {expanded ? (
          <ChevronDown size={14} className="shrink-0" />
        ) : (
          <ChevronRight size={14} className="shrink-0" />
        )}
      </button>

      {expanded && (
        <>
          <div
            ref={dropdownRef}
            className="relative  text-sm text-dark-tx"
          >
            <Searchbar
              className="flex-1"
              rightAdornment={
                <IconButton
                  icon={SlidersHorizontal}
                  onClick={() => setDropdownOpen((open) => !open)}
                />
              }
              dropdown={
                dropdownOpen ? (
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
                ) : null
              }
            />
          </div>

          <div
            className={cn(
              "overflow-x-auto h-full pb-8 text-sm text-dark-tx",
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
      )}
    </>
  );
};
