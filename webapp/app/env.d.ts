declare module "react-router" {
  interface AppLoadContext {
    cloudflare: {
      env: Env;
      context: ExecutionContext;
    };
  }
}

export {};
