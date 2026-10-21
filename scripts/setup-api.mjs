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

/**
 * Try candidates in order; return the first that exists and prints a version.
 * On Windows prefer `py -3.12` then `python3.12` then `python`.
 * On POSIX prefer `python3.12` then `python3` then `python`.
 */
function findSystemPython() {
  const candidates = isWin
    ? [['py', '-3.12'], ['python3.12'], ['python']]
    : [['python3.12'], ['python3'], ['python']];

  for (const parts of candidates) {
    const res = spawnSync(parts[0], [...parts.slice(1), '--version'], {
      encoding: 'utf-8',
      shell: false,
    });
    if (res.status === 0) {
      const ver = (res.stdout || res.stderr || '').trim();
      console.log(`>>> [setup:api] Found: ${parts.join(' ')} => ${ver}`);
      return parts;
    }
  }
  throw new Error(
    'No Python installation found on PATH. ' +
    'Please install Python 3.12 (https://python.org/downloads/).'
  );
}

/**
 * Run the chosen interpreter with --version and parse major.minor.
 * Fails loudly if the version is below 3.11.
 */
function assertMinPythonVersion(parts) {
  const res = spawnSync(parts[0], [...parts.slice(1), '--version'], {
    encoding: 'utf-8',
    shell: false,
  });
  const output = (res.stdout || res.stderr || '').trim();
  const match = output.match(/Python (\d+)\.(\d+)/i);
  if (!match) {
    throw new Error(`Could not parse Python version from: "${output}"`);
  }
  const major = parseInt(match[1], 10);
  const minor = parseInt(match[2], 10);
  if (major < 3 || (major === 3 && minor < 11)) {
    throw new Error(
      `Python ${major}.${minor} detected but Chat-Brain requires Python >= 3.11. ` +
      'Please install Python 3.12 or later.'
    );
  }
  console.log(`>>> [setup:api] Version check passed: Python ${major}.${minor}`);
}

console.log('>>> [setup:api] Initializing backend virtual environment...');

if (!fs.existsSync(venvPython)) {
  const pyParts = findSystemPython();
  assertMinPythonVersion(pyParts);

  console.log(`>>> [setup:api] Creating venv at ${venvDir}...`);
  const createRes = spawnSync(pyParts[0], [...pyParts.slice(1), '-m', 'venv', venvDir], {
    stdio: 'inherit',
    cwd: backendDir,
    shell: false,
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
  shell: false,
});

if (pipRes.status !== 0) {
  console.error('>>> [setup:api] Pip install failed.');
  process.exit(pipRes.status ?? 1);
}

console.log('>>> [setup:api] Backend setup successfully completed!');
