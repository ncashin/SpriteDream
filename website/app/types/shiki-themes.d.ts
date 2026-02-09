declare module "shiki/themes/*.mjs" {
  import type { ThemeRegistrationAny } from "shiki";
  const theme: ThemeRegistrationAny;
  export default theme;
}

