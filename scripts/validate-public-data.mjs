import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { readJson, snapshotDate, findProhibitedValues, PUBLIC_ROW_KEYS } from './public-data.mjs';

const repoDir = path.resolve(process.argv[2] ?? process.cwd());
const snapshotDir = path.join(repoDir, 'public/data/snapshots');
const files = (await readdir(snapshotDir)).filter((file) => /^\d{4}-\d{2}-\d{2}\.json$/.test(file));
if (!files.length) throw new Error('没有找到公开快照。');
const payloads = [];
for (const file of files) {
  const payload = await readJson(path.join(snapshotDir, file));
  payloads.push(payload);
  const date = snapshotDate(payload);
  if (file !== `${date}.json`) throw new Error(`文件名与快照日期不一致：${file}`);
  if (!Array.isArray(payload.rows)) throw new Error(`rows 不是数组：${file}`);
  const prohibited = findProhibitedValues(payload);
  if (prohibited.length) throw new Error(`公开快照包含禁止字段：${prohibited.join(', ')}`);
  for (const [index, row] of payload.rows.entries()) {
    if (!String(row.title ?? '').trim()) throw new Error(`${file} 第 ${index + 1} 条记录缺少标题。`);
    for (const key of Object.keys(row)) if (!PUBLIC_ROW_KEYS.includes(key)) throw new Error(`${file} 出现未声明字段：${key}`);
  }
}
const index = await readJson(path.join(repoDir, 'public/data/dates.json'));
if (index.currentDate !== files.map((file) => file.slice(0, 10)).sort().at(-1)) throw new Error('dates.json 的 currentDate 不正确。');
process.stdout.write(`公开数据校验通过：${files.length} 个日期，${payloads.reduce((sum, payload) => sum + payload.rows.length, 0)} 条记录\n`);
