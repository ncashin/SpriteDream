import { Box } from "lucide-react";
import dynamicIconImports from "lucide-react/dynamicIconImports";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "../../utils/cn.js";

type LeadIconComponent = typeof Box;

const sceneTreeIconSize = 14;
const sceneTreeIconClass = "text-white";

function normalizeIconSlug(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (t.includes("-")) return t.toLowerCase();
  return t
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

/** Scene-tree row icon when a nested object omits `__icon`. */
export const SCENE_OBJECT_PROPERTY_ICONS: Partial<Record<string, string>> = {
  boxCollider: "square",
  circleCollider: "circle",
  collisionBody: "atom",
  sprite: "image",
};

export function SceneTreeObjectLeadIcon({ iconKey }: { iconKey: unknown }) {
  const [Icon, setIcon] = useState<LeadIconComponent>(() => Box);

  useEffect(() => {
    if (typeof iconKey !== "string" || iconKey.trim() === "") {
      setIcon(() => Box);
      return;
    }
    const slug = normalizeIconSlug(iconKey);
    const loaders = dynamicIconImports as Record<
      string,
      () => Promise<{ default: LeadIconComponent }>
    >;
    const load = loaders[slug];
    if (!load) {
      setIcon(() => Box);
      return;
    }
    let cancelled = false;
    void load()
      .then((mod) => {
        if (!cancelled && mod?.default) {
          setIcon(() => mod.default);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIcon(() => Box);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [iconKey]);

  const Cmp = Icon;
  return <Cmp size={sceneTreeIconSize} className={sceneTreeIconClass} aria-hidden />;
}

const rowHover = "hover:bg-[var(--color-hover)]";

export const sceneTreeRowIconFrameSizeClass =
  "h-[18px] min-h-[18px] w-[18px] min-w-[18px] box-border";

export type SceneTreeRowIconFrameProps = {
  children: ReactNode;
  className?: string;
};

export function SceneTreeRowIconFrame({
  children,
  className,
}: SceneTreeRowIconFrameProps) {
  return (
    <div
      className={cn(
        "scene-tree-icon-frame flex shrink-0 self-center items-center justify-center rounded p-0.5",
        sceneTreeRowIconFrameSizeClass,
        rowHover,
        "opacity-70 hover:opacity-100",
        className,
      )}
    >
      {children}
    </div>
  );
}
