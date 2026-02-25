import { ChevronRight, Plus, X } from "lucide-react";
import { useState } from "react";
import type { Scene } from "../scene/scene";
import { PropertyDisplay } from "./PropertyDisplay";
import { IconButton } from "./IconButton";
import { ObjectIcon } from "./ObjectIcon";

export type ScenePath = string;

const isHiddenKey = (key: string) => key.startsWith("__");

export const ObjectDisplay = ({
  scene,
  path = "Scene",
  isDropdown = false,
  showHiddenProperties = false,
  onChange,
}: {
  scene: Scene;
  path?: string;
  isDropdown?: boolean;
  showHiddenProperties?: boolean;
  onChange?: (path: ScenePath, value: unknown) => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const sceneEntries = Object.entries(scene).filter(
    ([key]) => showHiddenProperties || !isHiddenKey(key),
  );

  const fullPathFor = (key: string) =>
    path === "Scene" ? key : `${path}.${key}`;

  if (!isDropdown) {
    return (
      <div>
        {sceneEntries.map(([key, value]) =>
          value && typeof value === "object" ? (
            <ObjectDisplay
              scene={value as Scene}
              path={key}
              key={key}
              isDropdown={true}
              showHiddenProperties={showHiddenProperties}
              onChange={onChange}
            />
          ) : (
            <PropertyDisplay
              entry={[key, value]}
              key={fullPathFor(key)}
              onChange={
                onChange
                  ? (newValue: unknown) => onChange(fullPathFor(key), newValue)
                  : undefined
              }
            />
          ),
        )}
      </div>
    );
  }
  return (
    <div className="flex flex-col w-full ">
      <div
        className="flex flex-row justify-between items-center w-full sidebar-hover rounded-md sidebar-padding-icon-row group cursor-pointer"
        onClick={() => {
          setExpanded(!expanded);
        }}
      >
        <div className="flex items-center gap-1.5">
          <ObjectIcon path={path} iconName={(scene as Record<string, unknown>).__icon} />
          <h1>{path.split(".").pop() ?? path}</h1>
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
      </div>

      {expanded && (
        <div className="pl-6.5 flex flex-col ">
          {sceneEntries.map(([key, value]) =>
            value && typeof value === "object" ? (
              <ObjectDisplay
                scene={value as Scene}
                path={fullPathFor(key)}
                key={key}
                isDropdown={true}
                showHiddenProperties={showHiddenProperties}
                onChange={onChange}
              />
            ) : (
              <PropertyDisplay
                entry={[key, value]}
                key={fullPathFor(key)}
                onChange={
                  onChange
                    ? (newValue: unknown) => onChange(fullPathFor(key), newValue)
                    : undefined
                }
              />
            ),
          )}
        </div>
      )}
    </div>
  );
};
