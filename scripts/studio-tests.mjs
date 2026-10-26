import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const python = [
  process.env.WEBSITE_BUILDER_PYTHON,
  resolve('.venv/bin/python'),
  resolve('../pixelcore-platform/pixelcore-backend/venv/bin/python'),
  'python3',
].find((p) => p && spawnSync(p, ['-c', 'import django'], { stdio: 'ignore' }).status === 0);
if (!python) throw new Error('Choose a Python environment with Django.');
process.exitCode =
  spawnSync(python, ['studio/server/run_tests.py'], {
    env: { ...process.env, PYTHONPATH: [resolve('python'), resolve('studio/server')].join(':') },
    stdio: 'inherit',
  }).status ?? 1;
