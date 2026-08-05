import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { readJson, snapshotDate, findProhibitedValues } from './public-data.mjs';
import { buildSeoArtifacts } from './seo.mjs';
import { dedupeTenderRows } from '../public/tender-data.js';

const repoDir = path.resolve(process.argv[2] ?? process.cwd());
const snapshotDir = path.join(repoDir, 'public/data/snapshots');
const outputPath = path.join(repoDir, 'public/data/dates.json');

await mkdir(snapshotDir, { recursive: true });
const files = (await readdir(snapshotDir)).filter((file) => /^\d{4}-\d{2}-\d{2}\.json$/.test(file));
const dates = [];
const snapshots = [];
for (const file of files) {
  const payload = await readJson(path.join(snapshotDir, file));
  const date = snapshotDate(payload);
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  const prohibited = findProhibitedValues(payload);
  if (prohibited.length) throw new Error(`公开快照包含禁止字段：${prohibited.join(', ')}`);
  dates.push({ date, count: dedupeTenderRows(date, rows).length, runAt: payload.runAt ?? '' });
  snapshots.push({ ...payload, date });
}
dates.sort((left, right) => right.date.localeCompare(left.date));
const generatedAt = dates.map((entry) => entry.runAt).filter(Boolean).sort().at(-1) ?? '';
await writeFile(outputPath, `${JSON.stringify({ generatedAt, dates, currentDate: dates[0]?.date ?? '' }, null, 2)}\n`);
const seo = await buildSeoArtifacts(repoDir, snapshots);
process.stdout.write(`生成 ${path.relative(repoDir, outputPath)}：${dates.length} 个日期，${seo.detailCount} 个SEO详情页\n`);
