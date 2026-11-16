import { defineConfig } from 'drizzle-kit';

// Generates the migrations of the shared medicines database. They're applied
// by admin-api at startup, never by hand.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './migrations',
});
