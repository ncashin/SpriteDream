import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle",
  schema: "./app/database/schema.ts",
  dialect: "sqlite",
  driver: "d1-http",
  dbCredentials: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? "",
    databaseId: "530fcb1c-c715-4aba-9d73-94145de4bf8d",
    token: process.env.CLOUDFLARE_D1_TOKEN ?? "",
  },
});
