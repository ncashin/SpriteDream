export const reorderObjectKeys = (
  object: Record<string, unknown>,
  key: string,
  targetKey: string,
  position: "before" | "after",
) => {
  const entries = Object.entries(object);

  const from = entries.findIndex(([entryKey]) => entryKey === key);
  const to = entries.findIndex(([entryKey]) => entryKey === targetKey);

  if (from < 0 || to < 0) return;

  const [moved] = entries.splice(from, 1);

  const targetIndex = entries.findIndex(([entryKey]) => entryKey === targetKey);
  const insertAt = position === "after" ? targetIndex + 1 : targetIndex;

  entries.splice(insertAt, 0, moved);

  Object.keys(object).forEach((k) => delete object[k]);
  Object.assign(object, Object.fromEntries(entries));
};
