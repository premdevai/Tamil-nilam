import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const statsPath = path.resolve(
  'apps/web/.next/diagnostics/route-bundle-stats.json',
);

// Uncompressed first-load budgets. Gzipped transfer is typically ~30% of this.
const budgets = new Map([
  ['/', 900_000],
  ['/land', 900_000],
  ['/schemes', 900_000],
]);

if (!existsSync(statsPath)) {
  console.error(
    'Missing apps/web/.next/diagnostics/route-bundle-stats.json. Run pnpm build first.',
  );
  process.exit(1);
}

const stats = JSON.parse(readFileSync(statsPath, 'utf8'));
const failures = [];

for (const [route, budget] of budgets) {
  const entry = stats.find((item) => item.route === route);
  if (entry === undefined) {
    failures.push(`${route}: missing from bundle stats`);
    continue;
  }
  if (entry.firstLoadUncompressedJsBytes > budget) {
    failures.push(
      `${route}: ${entry.firstLoadUncompressedJsBytes} bytes exceeds ${budget}`,
    );
  } else {
    console.log(
      `${route}: ${entry.firstLoadUncompressedJsBytes} / ${budget} uncompressed first-load bytes`,
    );
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}
