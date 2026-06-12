import { Box } from "lucide-react";
import DynamicIcon from "./DynamicIcon.js";

export function SceneIcon({ name }: { name: string | undefined }) {
  return <DynamicIcon name={name} size={14} className="text-white" fallback={Box} />;
}
