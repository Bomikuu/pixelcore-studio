import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
let count = 0;
async function scan(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) await scan(path);
    else if (/\.m?js$/.test(entry.name)) {
      const check = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
      if (check.status) throw new Error(check.stderr);
      count++;
    }
  }
}
await scan('packages');
await scan('scripts');
await scan('examples');
await scan('studio/web');
const publicFiles = [
  'packages/core/src/index.js',
  'packages/renderer/src/index.js',
  'packages/react/src/server.js',
];
for (const file of publicFiles) {
  const source = await readFile(file, 'utf8');
  if (/from ['"]@sitebuilder\/(editor|review|freeform)/.test(source))
    throw new Error(`Public entry imports editing runtime: ${file}`);
}
console.log(`Syntax and public entry checks passed (${count} modules).`);
