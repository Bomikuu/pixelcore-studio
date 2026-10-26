import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const candidates = [
  process.env.WEBSITE_BUILDER_PYTHON,
  resolve('.venv/bin/python'),
  resolve('../pixelcore-platform/pixelcore-backend/venv/bin/python'),
  'python3',
  'python',
];
const python = candidates.find(
  (p) => p && spawnSync(p, ['-c', 'import django'], { stdio: 'ignore' }).status === 0,
);
if (!python)
  throw new Error('Choose a Python environment with Django using WEBSITE_BUILDER_PYTHON.');
const result = spawnSync(python, ['python/run_tests.py'], {
  env: { ...process.env, PYTHONPATH: resolve('python') },
  stdio: 'inherit',
});
process.exitCode = result.status ?? 1;
