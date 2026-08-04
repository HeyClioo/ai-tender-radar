import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const SITE_ORIGIN = 'https://ai-tender-radar.vercel.app';
const SITE_NAME = 'AI招投标信息网';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character]);
}

function escapeXml(value) {
  return escapeHtml(value);
}

function compact(value, maximum = 180) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > maximum ? `${text.slice(0, maximum - 1).trim()}…` : text;
}

function displayDate(date) {
  const match = String(date).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[1]}年${Number(match[2])}月${Number(match[3])}日` : String(date);
}

export function tenderId(date, row) {
  const source = [date, row?.projectNo, row?.title, row?.buyer, row?.region].map((value) => String(value ?? '')).join('|');
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function tenderUrl(date, row) {
  return `${SITE_ORIGIN}/tenders/${date}/${tenderId(date, row)}/`;
}

function amountText(row) {
  return compact(row?.winnerAmountText || row?.budgetText, 80);
}

function detailDescription(date, row) {
  const parts = [
    `${displayDate(date)}，${compact(row.buyer || row.agency || '采购单位')}发布${compact(row.title, 72)}（${compact(row.noticeType || '招投标信息')}）`,
    row.projectNo ? `项目编号${compact(row.projectNo, 40)}` : '',
    row.region ? `地区${compact(row.region, 32)}` : '',
    amountText(row),
  ].filter(Boolean);
  const summary = compact(row.visibleSummary, 90);
  return compact(`${parts.join('，')}。${summary}`, 220);
}

function detailKeywords(row) {
  return [...new Set([
    compact(row.title, 80), 'AI招投标', 'AI招标公告', 'AI采购项目', '人工智能招标', '人工智能采购',
    compact(row.noticeType, 24), compact(row.buyer, 40), compact(row.region, 24),
  ].filter(Boolean))].join(',');
}

function detailHtml(date, runAt, row) {
  const url = tenderUrl(date, row);
  const title = compact(row.title, 120);
  const noticeType = compact(row.noticeType || '招投标信息', 32);
  const pageTitle = `${title}｜${noticeType}｜${SITE_NAME}`;
  const description = detailDescription(date, row);
  const published = String(row.publishText || '').match(/20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}/)?.[0]?.replace(/[/.]/g, '-') || date;
  const publishDisplay = /(?:刚刚|分钟前|小时前)/.test(String(row.publishText || '')) ? displayDate(date) : (row.publishText || displayDate(date));
  const modified = String(runAt || `${date}T00:00:00+08:00`);
  const amount = amountText(row);
  const metadata = [
    ['发布时间', publishDisplay],
    ['公告类型', noticeType],
    ['地区', row.region || '全国'],
    ['采购单位', row.buyer],
    ['代理单位', row.agency],
    ['项目编号', row.projectNo],
    [row.winnerAmountText ? '中标金额' : '预算金额', amount],
    ['分类', Array.isArray(row.categories) ? row.categories.join(' / ') : ''],
  ].filter(([, value]) => value);
  const structuredData = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title,
    headline: title,
    description,
    url,
    inLanguage: 'zh-CN',
    datePublished: published,
    dateModified: modified,
    isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: `${SITE_ORIGIN}/` },
    about: ['AI招投标', '人工智能采购', noticeType],
    primaryImageOfPage: { '@type': 'ImageObject', url: `${SITE_ORIGIN}/og-image.png` },
  }).replace(/</g, '\\u003c');
  const breadcrumbData = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: SITE_NAME, item: `${SITE_ORIGIN}/` },
      { '@type': 'ListItem', position: 2, name: displayDate(date), item: url },
    ],
  }).replace(/</g, '\\u003c');

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="theme-color" content="#f4f0e8">
    <title>${escapeHtml(pageTitle)}</title>
    <meta name="description" content="${escapeHtml(description)}">
    <meta name="keywords" content="${escapeHtml(detailKeywords(row))}">
    <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">
    <link rel="canonical" href="${url}">
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    <meta property="og:locale" content="zh_CN">
    <meta property="og:type" content="article">
    <meta property="og:site_name" content="${SITE_NAME}">
    <meta property="og:title" content="${escapeHtml(pageTitle)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:url" content="${url}">
    <meta property="og:image" content="${SITE_ORIGIN}/og-image.png">
    <meta property="article:published_time" content="${escapeHtml(published)}">
    <meta property="article:modified_time" content="${escapeHtml(modified)}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(pageTitle)}">
    <meta name="twitter:description" content="${escapeHtml(description)}">
    <meta name="twitter:image" content="${SITE_ORIGIN}/og-image.png">
    <script type="application/ld+json">${structuredData}</script>
    <script type="application/ld+json">${breadcrumbData}</script>
    <link rel="stylesheet" href="/styles.css">
  </head>
  <body class="seo-detail-page">
    <header class="topbar">
      <a class="brand" href="/" aria-label="返回AI招投标信息网">
        <span class="brand-mark"><span></span><span></span><span></span></span>
        <span>${SITE_NAME}</span>
      </a>
      <a class="detail-back" href="/">返回每日信息流</a>
    </header>
    <main class="seo-detail">
      <nav class="detail-breadcrumb" aria-label="面包屑"><a href="/">AI招投标信息</a><span>／</span><span>${escapeHtml(displayDate(date))}</span></nav>
      <article>
        <div class="detail-kicker"><span class="type-badge">${escapeHtml(noticeType)}</span><span>${escapeHtml(row.region || '全国')}</span><time datetime="${escapeHtml(published)}">${escapeHtml(publishDisplay)}</time></div>
        <h1>${escapeHtml(title)}</h1>
        <dl class="seo-detail-meta">${metadata.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</dl>
        <section class="seo-detail-body" aria-labelledby="notice-summary">
          <h2 id="notice-summary">公告摘要</h2>
          <p>${escapeHtml(row.visibleSummary || '页面未提供正文摘要。')}</p>
        </section>
      </article>
    </main>
    <footer class="footer"><span>${SITE_NAME}</span><span>全国AI招标公告与采购信息每日更新</span></footer>
  </body>
</html>
`;
}

export async function buildSeoArtifacts(repoDir, snapshots) {
  const publicDir = path.join(repoDir, 'public');
  const tenderDir = path.join(publicDir, 'tenders');
  await rm(tenderDir, { recursive: true, force: true });
  await mkdir(tenderDir, { recursive: true });

  const urls = [];
  const seenUrls = new Set();
  for (const snapshot of snapshots) {
    const date = snapshot.date;
    for (const row of snapshot.rows || []) {
      const id = tenderId(date, row);
      const url = tenderUrl(date, row);
      if (seenUrls.has(url)) continue;
      seenUrls.add(url);
      const outputDir = path.join(tenderDir, date, id);
      await mkdir(outputDir, { recursive: true });
      await writeFile(path.join(outputDir, 'index.html'), detailHtml(date, snapshot.runAt, row));
      urls.push({ url, lastmod: date });
    }
  }

  const latestDate = snapshots.map((snapshot) => snapshot.date).sort().at(-1) || new Date().toISOString().slice(0, 10);
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE_ORIGIN}/</loc><lastmod>${latestDate}</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>
${urls.map(({ url, lastmod }) => `  <url><loc>${escapeXml(url)}</loc><lastmod>${lastmod}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>`).join('\n')}
</urlset>
`;
  await writeFile(path.join(publicDir, 'sitemap.xml'), sitemap);
  await writeFile(path.join(publicDir, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`);
  return { detailCount: urls.length };
}
