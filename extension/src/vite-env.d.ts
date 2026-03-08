/// <reference types="vite/client" />

declare module "*.html" {
  const src: string;
  export default src;
}

declare module "*.html?raw" {
  const src: string;
  export default src;
}
