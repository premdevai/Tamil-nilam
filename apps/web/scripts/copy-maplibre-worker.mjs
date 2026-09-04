/**
 * Self-host MapLibre's web worker.
 *
 * mapcn defaults the worker URL to unpkg.com, which our CSP blocks (and which
 * would be a third-party runtime dependency on every map view). Copying the
 * worker that ships with the installed maplibre-gl keeps it same-origin and
 * version-matched. Runs before dev and build.
 */
import { copyFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const dist = path.join(
  path.dirname(require.resolve('maplibre-gl/package.json')),
  'dist',
);

// The worker imports './maplibre-gl-shared.mjs' as a sibling, so both files
// have to land next to each other or the worker aborts and the map silently
// never finishes loading its style.
const files = ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs'];

await mkdir(path.resolve('public'), { recursive: true });
for (const file of files) {
  await copyFile(path.join(dist, file), path.resolve('public', file));
}
console.log(`copied ${files.join(', ')} → public/`);
