import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

/** Migration tags of @cabinova/tenant-db, oldest first ("0000_baseline"…). */
const TAGS: string[] = (
  JSON.parse(
    readFileSync(
      join(
        dirname(
          createRequire(import.meta.url).resolve(
            '@cabinova/tenant-db/package.json',
          ),
        ),
        'migrations/meta/_journal.json',
      ),
      'utf8',
    ),
  ) as { entries: { tag: string }[] }
).entries.map((e) => e.tag);

/**
 * A cabinet's database is behind this code's schema: it's missing tables
 * or columns the clinic app uses. A version this code doesn't know yet
 * (admin-api deployed first with newer migrations) is not "behind".
 */
export function isBehind(version: string | null, tags = TAGS) {
  if (!version) return true;
  const index = tags.indexOf(version);
  return index !== -1 && index < tags.length - 1;
}
