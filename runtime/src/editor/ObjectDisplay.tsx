import { ChevronDown, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import type { Scene } from "../scene/scene";
import { PropertyDisplay } from "./PropertyDisplay";



export const ObjectDisplay = ({ scene, path = "Scene" }: { scene: Scene; path?: string }) => {
  const [expanded, setExpanded] = useState(false);
  const sceneEntries = useMemo(() => Object.entries(scene), [scene]);

  return (
    <div className="flex flex-col gap-2 w-full">
      <button
        className="flex flex-row items-center w-full group"
        onClick={() => {
          setExpanded(!expanded);
        }}
      >
        <h1 className="font-bold">{path}</h1>
        <span className="group-hover:visible group-hover:opacity-100 transition-opacity opacity-0">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
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
