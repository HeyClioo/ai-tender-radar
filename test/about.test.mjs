import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('首页右上角和页脚提供可抓取的关于页面链接', async () => {
  const html = await readFile(path.join(projectDir, 'public/index.html'), 'utf8');

  assert.match(html, /<a class="topbar-link" href="\/about\/">关于<\/a>/);
  assert.match(html, /<footer class="footer">[\s\S]*href="\/about\/"[\s\S]*<\/footer>/);
});

test('关于页面提供独立 SEO 信息、结构化数据和有用说明', async () => {
  const html = await readFile(path.join(projectDir, 'public/about/index.html'), 'utf8');

  assert.match(html, /<title>关于 AI 招投标信息网｜全国人工智能招标采购公开信息<\/title>/);
  assert.match(html, /<meta name="description" content="了解 AI 招投标信息网的数据范围、更新方式和使用方法，按日期查询全国人工智能招标公告、政府采购、采购意向与中标结果。" \/>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/ai-tender-radar\.vercel\.app\/about\/" \/>/);
  assert.match(html, /"@type": "AboutPage"/);
  assert.match(html, /<h1>关于 AI <span class="about-name">招投标信息网<\/span><\/h1>/);
  assert.match(html, /采购意向/);
  assert.match(html, /招标公告/);
  assert.match(html, /中标或成交结果/);
  assert.match(html, /以官方发布渠道的原始公告为准/);
  assert.match(html, /href="\/"[^>]*>浏览每日信息<\/a>/);
});
