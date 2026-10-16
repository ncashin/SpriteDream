const colors = ["#f43f5e", "#f59e0b", "#22c55e", "#38bdf8", "#a78bfa", "#fb7185"];

export function playerColor(value: string) {
  let total = 0;
  for (const char of value) total = (total + char.charCodeAt(0)) % colors.length;
  return colors[total];
}
