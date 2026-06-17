import { Cuboid, icons, type LucideIcon } from "lucide-react";

function isLucideIconKey(iconKey: string): iconKey is keyof typeof icons {
  return iconKey in icons;
}

function iconNameToKey(iconName: string): string {
  const trimmedName = iconName.trim();
  if (!trimmedName) return "";
  const kebabSlug = trimmedName.includes("-")
    ? trimmedName.toLowerCase()
    : trimmedName
        .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
        .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
        .toLowerCase();
  return kebabSlug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

export default function DynamicIcon({
  name,
  size = 14,
  className,
  fallback = Cuboid,
}: {
  name?: string | null;
  size?: number;
  className?: string;
  fallback?: LucideIcon;
}) {
  const iconKey = name ? iconNameToKey(name) : "";
  const Icon =
    iconKey && isLucideIconKey(iconKey) ? icons[iconKey] : fallback;
  return <Icon size={size} className={className} />;
}
