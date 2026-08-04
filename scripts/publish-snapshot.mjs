import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { readJson, sanitizeSnapshot, findProhibitedValues } from './public-data.mjs';
import { spawn } from 'node:child_process';

function argument(name, fallback = '') {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`${command} 退出码 ${code}`)));
  });
}

const rawInput = argument('--input');
if (!rawInput) throw new Error('请提供 --input 快照路径。');
const inputPath = path.resolve(rawInput);
const repoDir = path.resolve(argument('--repo', process.cwd()));
const snapshot = sanitizeSnapshot(await readJson(inputPath));
const prohibited = findProhibitedValues(snapshot);
if (prohibited.length) throw new Error(`拒绝发布，发现禁止内容：${prohibited.join(', ')}`);
const targetDir = path.join(repoDir, 'data/snapshots');
await mkdir(targetDir, { recursive: true });
await writeFile(path.join(targetDir, `${snapshot.date}.json`), `${JSON.stringify(snapshot, null, 2)}\n`);
await run(process.execPath, [path.join(repoDir, 'scripts/build-data-index.mjs'), repoDir], repoDir);
await run(process.execPath, [path.join(repoDir, 'scripts/validate-public-data.mjs'), repoDir], repoDir);
process.stdout.write(`已准备公开快照：${snapshot.date}，${snapshot.rows.length} 条\n`);
