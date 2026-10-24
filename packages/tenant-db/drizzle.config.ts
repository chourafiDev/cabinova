import { defineConfig } from 'drizzle-kit';

// Generates the migrations every clinic database receives. They're applied
// by admin-api (provisioning, "Migrer"), never by hand against one clinic.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './migrations',
});
