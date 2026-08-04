import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { readJson, snapshotDate, findProhibitedValues } from './public-data.mjs';

const repoDir = path.resolve(process.argv[2] ?? process.cwd());
const snapshotDir = path.join(repoDir, 'public/data/snapshots');
const outputPath = path.join(repoDir, 'public/data/dates.json');

await mkdir(snapshotDir, { recursive: true });
const files = (await readdir(snapshotDir)).filter((file) => /^\d{4}-\d{2}-\d{2}\.json$/.test(file));
const dates = [];
for (const file of files) {
  const payload = await readJson(path.join(snapshotDir, file));
  const date = snapshotDate(payload);
  const prohibited = findProhibitedValues(payload);
  if (prohibited.length) throw new Error(`公开快照包含禁止字段：${prohibited.join(', ')}`);
  dates.push({ date, count: Array.isArray(payload.rows) ? payload.rows.length : 0, runAt: payload.runAt ?? '' });
}
dates.sort((left, right) => right.date.localeCompare(left.date));
await writeFile(outputPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), dates, currentDate: dates[0]?.date ?? '' }, null, 2)}\n`);
process.stdout.write(`生成 ${path.relative(repoDir, outputPath)}：${dates.length} 个日期\n`);
