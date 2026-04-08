import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';
import invariant from 'tiny-invariant';

invariant(process.env.DB_FILE_NAME);

export default defineConfig({
  out: './drizzle',
  schema: './app/database/schema.ts',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DB_FILE_NAME,
  },
});
