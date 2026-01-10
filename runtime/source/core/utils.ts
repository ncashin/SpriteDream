export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export const isDevelopment =
  typeof import.meta !== "undefined" &&
  import.meta.env &&
  import.meta.env.DEV;