import { spawn } from 'node:child_process';
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

if (!fs.existsSync(venvPython)) {
  console.error('>>> [test:api] Backend virtual environment not found.');
  console.error('>>> [test:api] Please run "npm run setup:api" first.');
  process.exit(1);
}

console.log('>>> [test:api] Running backend pytest suite...');

const proc = spawn(
  venvPython,
  ['-m', 'pytest', '-v'],
  {
    stdio: 'inherit',
    cwd: backendDir,
    shell: false
  }
);

proc.on('close', (code) => {
  process.exit(code ?? 0);
});
