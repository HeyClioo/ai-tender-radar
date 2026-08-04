import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const copyModulePath = path.join(projectDir, 'public/copy-title.js');

test('复制标题时只写入标题文本', async () => {
  assert.equal(existsSync(copyModulePath), true, '应提供独立的标题复制函数');
  const { copyTitle } = await import(pathToFileURL(copyModulePath));
  let copiedText = '';
  const clipboard = { writeText: async (text) => { copiedText = text; } };

  assert.equal(await copyTitle('  某高校 AI 助教采购项目  ', clipboard), true);
  assert.equal(copiedText, '某高校 AI 助教采购项目');
});

test('详情标题右侧提供复制图标按钮', async () => {
  const [app, styles] = await Promise.all([
    readFile(path.join(projectDir, 'public/app.js'), 'utf8'),
    readFile(path.join(projectDir, 'public/styles.css'), 'utf8'),
  ]);

  assert.match(app, /class="dialog-title-row"/);
  assert.match(app, /class="copy-title-button"[^>]+aria-label="复制标题"/);
  assert.match(app, /await copyTitle\(row\.title\)/);
  assert.match(styles, /\.dialog-title-row\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto/s);
});
