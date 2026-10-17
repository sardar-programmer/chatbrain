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
  console.error('>>> [dev:api] Backend virtual environment not found.');
  console.error('>>> [dev:api] Please run "npm run setup:api" first.');
  process.exit(1);
}

console.log('>>> [dev:api] Starting Chat-Brain backend on http://127.0.0.1:8000 (reload enabled)...');

const proc = spawn(
  venvPython,
  ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000', '--reload'],
  {
    stdio: 'inherit',
    cwd: backendDir,
    shell: false
  }
);

proc.on('close', (code) => {
  process.exit(code ?? 0);
});
