import { Box, type LucideIcon } from "lucide-react";
import dynamicIconImports from "lucide-react/dynamicIconImports";
import { useEffect, useState } from "react";

export function SceneIcon({ name }: { name: string | undefined }) {
  const [Icon, setIcon] = useState<LucideIcon>(() => Box);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const load = name?.trim()
        ? (dynamicIconImports as Record<string, () => Promise<{ default: LucideIcon }>>)[
            name.trim()
          ]
        : undefined;

      if (!load) {
        if (!cancelled) setIcon(() => Box);
        return;
      }

      try {
        const { default: NextIcon } = await load();
        if (!cancelled && NextIcon) setIcon(() => NextIcon);
      } catch {
        if (!cancelled) setIcon(() => Box);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [name]);

  return <Icon size={14} className="text-white" aria-hidden />;
}
