export const GAMEIDE_DOMAIN = "gameide.app";

export class InvalidGameIdError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidGameIdError";
  }
}

export class GameIdConflictError extends Error {
  constructor(public id: string) {
    super("A game with this name already exists");
    this.name = "GameIdConflictError";
  }
}

export function getGameIDEDomain(env: Env): string {
  return env.GAMEIDE_DOMAIN?.trim() || GAMEIDE_DOMAIN;
}

export function getEffectiveGameIDEDomain(requestURL: URL, env: Env): string {
  const host = requestURL.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) {
    return "localhost";
  }
  return getGameIDEDomain(env);
}

export function getGameBundleOrigin(
  id: string,
  env: Env,
  requestURL?: URL,
): string {
  const domain = requestURL
    ? getEffectiveGameIDEDomain(requestURL, env)
    : getGameIDEDomain(env);
  if (domain === "localhost") {
    return `http://${id}.${domain}`;
  }
  return `https://${id}.${domain}`;
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
    throw new InvalidGameIdError("Game name must contain letters or numbers");
  }
  if (id.length > 63) {
    throw new InvalidGameIdError("Game name is too long");
  }
}

export function idFromTitle(title: string): string {
  const id = titleToId(title);
  assertValidGameId(id);
  return id;
}

export function isValidGameId(id: string): boolean {
  try {
    assertValidGameId(id);
    return true;
  } catch {
    return false;
  }
}

export function getGameIdFromHost(
  hostname: string,
  domain: string,
): string | null {
  const host = hostname.toLowerCase();
  const bareDomain = domain.toLowerCase();

  if (host === bareDomain || host === `www.${bareDomain}`) {
    return null;
  }

  const suffix = `.${bareDomain}`;
  if (!host.endsWith(suffix)) {
    return null;
  }

  const id = host.slice(0, -suffix.length);
  if (!id || id.includes(".")) {
    return null;
  }

  return id;
}

export function getGameBundleURL(
  id: string,
  requestURL: URL,
  env: Env,
): string {
  const domain = getEffectiveGameIDEDomain(requestURL, env);
  const origin = getGameBundleOrigin(id, env, requestURL);
  if (domain === "localhost" && requestURL.port) {
    return `${origin}:${requestURL.port}/`;
  }
  return `${origin}/`;
}
