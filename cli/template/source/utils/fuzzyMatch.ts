export function fuzzyScore(query: string, text: string): number | null {
  const normalizedQuery = query.trim().toLowerCase();
  const normalizedText = text.toLowerCase();

  if (!normalizedQuery) return 0;

  const substringIndex = normalizedText.indexOf(normalizedQuery);
  if (substringIndex >= 0) {
    return 1000 - substringIndex;
  }

  let queryIndex = 0;
  let score = 0;
  let lastMatchIndex = -1;

  for (
    let textIndex = 0;
    textIndex < normalizedText.length && queryIndex < normalizedQuery.length;
    textIndex++
  ) {
    if (normalizedText[textIndex] !== normalizedQuery[queryIndex]) continue;

    score += 1;
    if (lastMatchIndex === textIndex - 1) score += 5;
    if (
      textIndex === 0 ||
      normalizedText[textIndex - 1] === "/" ||
      normalizedText[textIndex - 1] === "." ||
      normalizedText[textIndex - 1] === "-" ||
      normalizedText[textIndex - 1] === "_"
    ) {
      score += 3;
    }

    lastMatchIndex = textIndex;
    queryIndex++;
  }

  if (queryIndex !== normalizedQuery.length) return null;
  return score - normalizedText.length * 0.01;
}

export function fuzzyFilter(query: string, items: readonly string[]): string[] {
  return items
    .map((item) => ({ item, score: fuzzyScore(query, item) }))
    .filter((entry): entry is { item: string; score: number } => entry.score != null)
    .sort((a, b) => b.score - a.score || a.item.localeCompare(b.item))
    .map((entry) => entry.item);
}
