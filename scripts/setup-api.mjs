import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const backendDir = path.join(rootDir, 'backend');
const venvDir = path.join(backendDir, '.venv');

const isWin = process.platform === 'win32';
const venvPython = isWin
  ? path.join(venvDir, 'Scripts', 'python.exe')
  : path.join(venvDir, 'bin', 'python');

function findSystemPython() {
  const candidates = isWin ? ['python', 'py'] : ['python3', 'python'];
  for (const cmd of candidates) {
    const res = spawnSync(cmd, ['--version'], {
      encoding: 'utf-8',
      shell: false
    });
    if (res.status === 0) {
      return cmd;
    }
  }
  throw new Error('No Python installation found on PATH. Please install Python 3.10+.');
}

console.log('>>> [setup:api] Initializing backend virtual environment...');

if (!fs.existsSync(venvPython)) {
  const sysPython = findSystemPython();
  console.log(`>>> [setup:api] Creating venv at ${venvDir}...`);
  const createRes = spawnSync(sysPython, ['-m', 'venv', venvDir], {
    stdio: 'inherit',
    cwd: backendDir,
    shell: false
  });
  if (createRes.status !== 0) {
    console.error('>>> [setup:api] Failed to create virtual environment.');
    process.exit(createRes.status ?? 1);
  }
} else {
  console.log('>>> [setup:api] Virtual environment already exists.');
}

const reqFile = path.join(backendDir, 'requirements.txt');
console.log(`>>> [setup:api] Installing pinned dependencies from ${reqFile}...`);
const pipRes = spawnSync(venvPython, ['-m', 'pip', 'install', '--default-timeout=100', '-r', reqFile], {
  stdio: 'inherit',
  cwd: backendDir,
  shell: false
});

if (pipRes.status !== 0) {
  console.error('>>> [setup:api] Pip install failed.');
  process.exit(pipRes.status ?? 1);
}

console.log('>>> [setup:api] Backend setup successfully completed!');
