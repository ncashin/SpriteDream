const colors = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#84cc16",
  "#22c55e",
  "#14b8a6",
  "#06b6d4",
  "#3b82f6",
  "#6366f1",
  "#a855f7",
  "#d946ef",
  "#ec4899",
];

export function playerColor(value: string) {
  let total = 0;
  for (const char of value) total = (total + char.charCodeAt(0)) % colors.length;
  return colors[total];
}
