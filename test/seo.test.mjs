import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const buildScript = path.join(projectDir, 'scripts/build-data-index.mjs');

test('生产首页保留 Google Search Console 所有权验证标签', async () => {
  const html = await readFile(path.join(projectDir, 'public/index.html'), 'utf8');
  assert.match(
    html,
    /<meta name="google-site-verification" content="UXeSjPRmtX5kloll-gV3GungHWvIT2Dbhyt2M7LigRY" \/>/,
  );
});

test('首页与 README 使用用户查询意图描述 AI 招投标信息', async () => {
  const [html, readme, packageJson] = await Promise.all([
    readFile(path.join(projectDir, 'public/index.html'), 'utf8'),
    readFile(path.join(projectDir, 'README.md'), 'utf8'),
    readFile(path.join(projectDir, 'package.json'), 'utf8').then(JSON.parse),
  ]);
  assert.match(html, /<title>AI招投标信息网｜全国人工智能招标公告、政府采购与中标结果<\/title>/);
  assert.match(html, /<meta name="description" content="查询全国AI及人工智能招投标信息[^\"]+每日更新。" \/>/);
  assert.match(html, /<span class="eyebrow">全国 AI 招标采购信息<\/span>/);
  assert.match(readme, /^# AI 招投标信息网｜全国人工智能招标公告、政府采购与中标结果/m);
  assert.match(packageJson.description, /查询全国AI及人工智能招投标信息/);
});

async function withFixture(run) {
  const repoDir = await mkdtemp(path.join(tmpdir(), 'ai-tender-seo-'));
  const snapshotDir = path.join(repoDir, 'public/data/snapshots');
  await mkdir(snapshotDir, { recursive: true });
  const row = {
    title: '某高校AI助教智能体采购项目',
    visibleSummary: '采购AI助教、知识库问答与课程资源生成服务。',
    noticeType: '招标公告',
    region: '广东省-广州市',
    buyer: '某高校',
    agency: '某代理机构',
    projectNo: 'AI-2026-001',
    budgetText: '预算19万元',
    winnerAmountText: '',
    publishText: '2小时前',
    categories: ['服务', '教育'],
  };
  await writeFile(path.join(snapshotDir, '2026-08-03.json'), JSON.stringify({
    date: '2026-08-03',
    runAt: '2026-08-04T08:00:00+08:00',
    rows: [row, row],
  }));
  try {
    await execFileAsync(process.execPath, [buildScript, repoDir]);
    await run(repoDir);
  } finally {
    await rm(repoDir, { recursive: true, force: true });
  }
}

test('数据索引构建时生成 robots、sitemap 和可抓取的公告详情页', async () => {
  await withFixture(async (repoDir) => {
    const sitemapPath = path.join(repoDir, 'public/sitemap.xml');
    assert.equal(existsSync(path.join(repoDir, 'public/robots.txt')), true, '应生成 robots.txt');
    assert.equal(existsSync(sitemapPath), true, '应生成 sitemap.xml');

    const sitemap = await readFile(sitemapPath, 'utf8');
    const detailUrl = sitemap.match(/<loc>(https:\/\/ai-tender-radar\.vercel\.app\/tenders\/2026-08-03\/[^<]+\/)<\/loc>/)?.[1];
    assert.ok(detailUrl, 'sitemap 应包含公告独立 URL');
    assert.equal((sitemap.match(/\/tenders\/2026-08-03\//g) || []).length, 1, '重复记录不应产生重复 sitemap URL');

    const detailPath = path.join(repoDir, 'public', new URL(detailUrl).pathname, 'index.html');
    assert.equal(existsSync(detailPath), true, '公告 URL 应有静态 HTML');
  });
});

test('公告详情页提供唯一标题、摘要、canonical、结构化数据和可见正文', async () => {
  await withFixture(async (repoDir) => {
    const sitemapPath = path.join(repoDir, 'public/sitemap.xml');
    assert.equal(existsSync(sitemapPath), true, '应先生成 sitemap.xml');
    const sitemap = await readFile(sitemapPath, 'utf8');
    const detailUrl = sitemap.match(/<loc>(https:\/\/ai-tender-radar\.vercel\.app\/tenders\/2026-08-03\/[^<]+\/)<\/loc>/)?.[1];
    assert.ok(detailUrl);
    const html = await readFile(path.join(repoDir, 'public', new URL(detailUrl).pathname, 'index.html'), 'utf8');

    assert.match(html, /<title>某高校AI助教智能体采购项目｜招标公告｜AI招投标信息网<\/title>/);
    assert.match(html, /<meta name="description" content="[^"]*某高校[^"]*19万元[^"]*">/);
    assert.match(html, new RegExp(`<link rel="canonical" href="${detailUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}">`));
    assert.match(html, /<script type="application\/ld\+json">/);
    assert.match(html, /<h1>某高校AI助教智能体采购项目<\/h1>/);
    assert.match(html, /采购AI助教、知识库问答与课程资源生成服务。/);
    assert.match(html, /<time datetime="2026-08-03">2026年8月3日<\/time>/);
    assert.doesNotMatch(html, />2小时前<\/time>/);
  });
});
