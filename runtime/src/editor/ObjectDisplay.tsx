import { ChevronDown, ChevronRight, Cross, GripVertical, Plus, Trash, TrashIcon, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { Scene } from "../scene/scene";
import { PropertyDisplay } from "./PropertyDisplay";
import { cn } from "../utils/cn";
import { IconButton } from "./IconButton";

export const ObjectDisplay = ({ scene, path = "Scene" }: { scene: Scene; path?: string }) => {
  const [expanded, setExpanded] = useState(false);
  const sceneEntries = useMemo(() => Object.entries(scene), [scene]);

  return (
    <div className={cn("flex flex-col gap-2 w-full", expanded && "pb-3.5")}>
      <button
        className="flex flex-row justify-between items-center w-full  hover:bg-dark-ui rounded-md p-internal-sidebar group"
        onClick={() => {
          setExpanded(!expanded);
        }}
      >
        <h1 className="font-bold">{path}</h1>
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

      {expanded &&
        sceneEntries.map(([key, value]) =>
          value && typeof value === "object" ? (
            <ObjectDisplay scene={value as Scene} path={key} />
          ) : (
            <PropertyDisplay entry={[key, value]} />
          ),
        )}
    </div>
  );
};
