import { useState } from "react";
import { useSceneFile } from "gameide";
import { Dropdown } from "./Dropdown.js";
import { cn } from "../../utils/cn.js";

const NEW_SCENE_VALUE = "__new_scene__";

export function SceneFileHeader({ className }: { className?: string }) {
  const { scenes, activeScenePath, isUntitled, switchScene, createScene } =
    useSceneFile();
  const [open, setOpen] = useState(false);
  const label = isUntitled ? "New Scene" : activeScenePath || "Select…";

  return (
    <div className={className}>
      <Dropdown
        open={open}
        onOpenChange={setOpen}
        options={[
          { value: NEW_SCENE_VALUE, label: "New Scene" },
          ...scenes.map((file) => ({ value: file, label: file })),
        ]}
        onChange={(file) => {
          if (file === NEW_SCENE_VALUE) {
            void createScene();
            return;
          }
          void switchScene(file);
        }}
        searchPlaceholder="Search scenes…"
        emptyMessage="No scenes found"
        className="w-full min-w-0"
      >
        <button
          type="button"
          aria-label="Active scene file"
          aria-haspopup="listbox"
          aria-expanded={open}
          title={label}
          onClick={() => setOpen((current) => !current)}
          className={cn(
            "w-full min-w-0 truncate border-0 bg-transparent px-2 py-1.5 text-left text-sm font-medium text-[var(--color-text)] cursor-pointer outline-none hover:bg-[var(--color-hover)] focus-visible:ring-1 focus-visible:ring-[var(--color-highlight)]",
            open && "bg-[var(--color-hover)]",
          )}
        >
          {label}
        </button>
      </Dropdown>
    </div>
  );
}
