import { Cuboid, icons } from "lucide-react";

type LucideIcon = typeof Cuboid;

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

function resolveIcon(iconKey: string): LucideIcon {
  if (!isLucideIconKey(iconKey)) return Cuboid;
  return icons[iconKey];
}

export default function DynamicIcon({
  name,
  size = 14,
  className,
}: {
  name?: string | null;
  size?: number;
  className?: string;
}) {
  const iconKey = name ? iconNameToKey(name) : "";
  const Icon = iconKey ? resolveIcon(iconKey) : Cuboid;
  return <Icon size={size} className={className} />;
}
