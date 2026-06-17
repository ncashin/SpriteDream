export class InvalidGameIdError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidGameIdError";
  }
}

export function titleToId(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function assertValidGameId(id: string): void {
  if (!id) {
    throw new InvalidGameIdError("Game URL slug must contain letters or numbers");
  }
  if (id.length > 63) {
    throw new InvalidGameIdError("Game URL slug is too long");
  }
}

export function defaultIdFromName(name: string): string {
  const id = titleToId(name);
  assertValidGameId(id);
  return id;
}
