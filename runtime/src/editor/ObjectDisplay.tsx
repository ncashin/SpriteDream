import { Box, ChevronRight, Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { Scene } from "../scene/scene";
import { PropertyDisplay } from "./PropertyDisplay";
import { IconButton } from "./IconButton";

export const ObjectDisplay = ({
  scene,
  path = "Scene",
  isDropdown = false,
}: {
  scene: Scene;
  path?: string;
  isDropdown?: boolean;
}) => {
  const [expanded, setExpanded] = useState(false);
  const sceneEntries = useMemo(() => Object.entries(scene), [scene]);

  if (!isDropdown) {
    return (
      <div>
        {sceneEntries.map(([key, value]) =>
          value && typeof value === "object" ? (
            <ObjectDisplay scene={value as Scene} path={key} key={key} isDropdown={true} />
          ) : (
            <PropertyDisplay entry={[key, value]} key={key} />
          ),
        )}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-0.5 w-full">
      <button
        className="flex flex-row justify-between items-center w-full hover:bg-dark-ui rounded-md p-internal-sidebar group cursor-pointer"
        onClick={() => {
          setExpanded(!expanded);
        }}
      >
        <div className="flex items-center gap-1.5">
        <IconButton icon={Box} />

          <h1 className="font-bold">{path}</h1>
        </div>
        <div className="flex flex-row group-hover-visible">
          <IconButton icon={Plus} />
          <IconButton icon={X} />
          <IconButton
            icon={ChevronRight}
            style={{
              transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform 0.2s",
            }}
          />
        </div>
      </button>

      {expanded && (
        <div className="pl-5.5">
          {sceneEntries.map(([key, value]) =>
            value && typeof value === "object" ? (
              <ObjectDisplay scene={value as Scene} path={key} key={key} isDropdown={true} />
            ) : (
              <PropertyDisplay entry={[key, value]} key={key} />
            ),
          )}
        </div>
      )}
    </div>
  );
};
