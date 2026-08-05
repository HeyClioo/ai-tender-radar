import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { cleanTenderSummary, dedupeTenderRows, tenderId } from '../public/tender-data.js';

const SITE_ORIGIN = 'https://ai-tender-radar.vercel.app';
const SITE_NAME = 'AI招投标信息网';
const ABOUT_LASTMOD = '2026-08-04';

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

export { tenderId };

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
  const summary = compact(cleanTenderSummary(row.title, row.visibleSummary), 90);
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
  const dateUrl = `${SITE_ORIGIN}/date/${date}/`;
  const title = compact(row.title, 120);
  const noticeType = compact(row.noticeType || '招投标信息', 32);
  const pageTitle = `${title}｜${noticeType}｜${SITE_NAME}`;
  const description = detailDescription(date, row);
  const published = String(row.publishText || '').match(/20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}/)?.[0]?.replace(/[/.]/g, '-') || date;
  const publishDisplay = /(?:刚刚|分钟前|小时前)/.test(String(row.publishText || '')) ? displayDate(date) : (row.publishText || displayDate(date));
  const modified = String(runAt || `${date}T00:00:00+08:00`);
  const amount = amountText(row);
  const visibleSummary = cleanTenderSummary(row.title, row.visibleSummary) || '页面未提供正文摘要。';
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
      { '@type': 'ListItem', position: 2, name: displayDate(date), item: dateUrl },
      { '@type': 'ListItem', position: 3, name: title, item: url },
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
      <nav class="topbar-nav" aria-label="主导航"><a class="topbar-link" href="/">每日信息</a><a class="topbar-link" href="/about/">关于</a></nav>
    </header>
    <main class="seo-detail">
      <nav class="detail-breadcrumb" aria-label="面包屑"><a href="/">AI招投标信息</a><span>／</span><a href="/date/${date}/">${escapeHtml(displayDate(date))}</a></nav>
      <article>
        <div class="detail-kicker"><span class="type-badge">${escapeHtml(noticeType)}</span><span>${escapeHtml(row.region || '全国')}</span><time datetime="${escapeHtml(published)}">${escapeHtml(publishDisplay)}</time></div>
        <h1>${escapeHtml(title)}</h1>
        <dl class="seo-detail-meta">${metadata.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</dl>
        <section class="seo-detail-body" aria-labelledby="notice-summary">
          <h2 id="notice-summary">公告摘要</h2>
          <p>${escapeHtml(visibleSummary)}</p>
        </section>
      </article>
    </main>
    <footer class="footer"><span>${SITE_NAME}</span><nav class="footer-links" aria-label="页脚导航"><span>全国AI招标公告与采购信息每日更新</span><a href="/about/">关于</a></nav></footer>
  </body>
</html>
`;
}

function dateUrl(date) {
  return `${SITE_ORIGIN}/date/${date}/`;
}

function feedDisplayDate(date, publishText) {
  const value = String(publishText ?? '').trim();
  const match = value.match(/20\d{2}[-/.年](\d{1,2})[-/.月](\d{1,2})/u);
  if (match) return `${match[1].padStart(2, '0')}.${match[2].padStart(2, '0')}`;
  const dateMatch = String(date).match(/^20\d{2}-(\d{2})-(\d{2})$/u);
  return dateMatch ? `${dateMatch[1]}.${dateMatch[2]}` : value || '—';
}

function typeClass(type) {
  if (/中标|成交|结果/u.test(type)) return 'result';
  if (/意向/u.test(type)) return 'intent';
  return '';
}

function feedItemHtml(date, row, index) {
  const noticeType = compact(row.noticeType || '未分类', 32);
  const summary = compact(cleanTenderSummary(row.title, row.visibleSummary) || '页面未提供正文摘要。', 220);
  const buyer = compact(row.buyer || row.agency || '采购单位未披露', 80);
  const amount = amountText(row);
  const amountLabel = row.winnerAmountText ? '中标' : '预算';
  return `<a class="feed-item" data-index="${index}" href="/tenders/${date}/${tenderId(date, row)}/" aria-label="查看：${escapeHtml(row.title)}">
    <div class="item-time">${escapeHtml(feedDisplayDate(date, row.publishText))}</div>
    <div class="item-main"><div class="item-kicker"><span class="type-badge ${typeClass(noticeType)}">${escapeHtml(noticeType)}</span><span>${escapeHtml(row.region || '全国')}</span></div><h3>${escapeHtml(row.title)}</h3><p>${escapeHtml(summary)}</p><div class="item-meta"><strong>${escapeHtml(buyer)}</strong>${row.projectNo ? ` <span>· ${escapeHtml(row.projectNo)}</span>` : ''}</div></div>
    <div class="item-amount ${amount ? 'has-amount' : 'empty'}">${amount ? `<span>${amountLabel}</span><strong>${escapeHtml(amount.replace(/^(?:预算|中标|成交)(?:金额)?[：:]?\s*/u, ''))}</strong><small>人民币</small>` : ''}</div>
    <span class="item-open" aria-hidden="true">↗</span>
  </a>`;
}

function archiveHtml(snapshot, rows, orderedDates) {
  const { date, runAt } = snapshot;
  const url = dateUrl(date);
  const label = displayDate(date);
  const index = orderedDates.indexOf(date);
  const newerDate = index > 0 ? orderedDates[index - 1] : '';
  const olderDate = index >= 0 && index < orderedDates.length - 1 ? orderedDates[index + 1] : '';
  const description = `${label}全国AI及人工智能招投标公开信息，共${rows.length}条，包含招标公告、政府采购、采购意向、中标公告和中标结果。`;
  const pageTitle = `${label} AI招标公告、政府采购与中标结果｜${SITE_NAME}`;
  const collectionData = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${label} AI招投标信息`,
    description,
    url,
    inLanguage: 'zh-CN',
    dateModified: String(runAt || `${date}T00:00:00+08:00`),
    isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: `${SITE_ORIGIN}/` },
  }).replace(/</g, '\\u003c');
  const itemListData = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${label} AI招投标信息`,
    numberOfItems: rows.length,
    itemListElement: rows.slice(0, 100).map((row, rowIndex) => ({
      '@type': 'ListItem',
      position: rowIndex + 1,
      url: tenderUrl(date, row),
      name: compact(row.title, 120),
    })),
  }).replace(/</g, '\\u003c');
  const breadcrumbData = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: SITE_NAME, item: `${SITE_ORIGIN}/` },
      { '@type': 'ListItem', position: 2, name: label, item: url },
    ],
  }).replace(/</g, '\\u003c');
  const navigation = [
    olderDate ? `<a href="/date/${olderDate}/" rel="prev">← ${escapeHtml(displayDate(olderDate))}</a>` : '<span></span>',
    newerDate ? `<a href="/date/${newerDate}/" rel="next">${escapeHtml(displayDate(newerDate))} →</a>` : '<span></span>',
  ].join('');

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="theme-color" content="#f4f0e8">
    <title>${escapeHtml(pageTitle)}</title>
    <meta name="description" content="${escapeHtml(description)}">
    <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">
    <link rel="canonical" href="${url}">
${olderDate ? `    <link rel="prev" href="${dateUrl(olderDate)}">\n` : ''}${newerDate ? `    <link rel="next" href="${dateUrl(newerDate)}">\n` : ''}    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    <meta property="og:locale" content="zh_CN">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="${SITE_NAME}">
    <meta property="og:title" content="${escapeHtml(pageTitle)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:url" content="${url}">
    <meta property="og:image" content="${SITE_ORIGIN}/og-image.png">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(pageTitle)}">
    <meta name="twitter:description" content="${escapeHtml(description)}">
    <meta name="twitter:image" content="${SITE_ORIGIN}/og-image.png">
    <script type="application/ld+json">${collectionData}</script>
    <script type="application/ld+json">${itemListData}</script>
    <script type="application/ld+json">${breadcrumbData}</script>
    <link rel="stylesheet" href="/styles.css">
  </head>
  <body class="archive-page">
    <div class="app-shell">
      <header class="topbar">
        <a class="brand" href="/" aria-label="返回AI招投标信息网"><span class="brand-mark"><span></span><span></span><span></span></span><span>${SITE_NAME}</span></a>
        <nav class="topbar-nav" aria-label="主导航"><a class="topbar-link" href="/">每日信息</a><a class="topbar-link" href="/about/">关于</a></nav>
      </header>
      <main>
        <nav class="detail-breadcrumb archive-breadcrumb" aria-label="面包屑"><a href="/">AI招投标信息</a><span>／</span><span>${escapeHtml(label)}</span></nav>
        <section class="archive-head" aria-labelledby="archive-title">
          <div><span class="eyebrow">全国 AI 招标采购信息</span><h1 id="archive-title">${escapeHtml(label)}</h1></div>
          <div class="archive-count"><strong>${rows.length.toLocaleString('zh-CN')}</strong><span>条公开信息</span></div>
        </section>
        <section class="feed-section archive-feed" aria-label="${escapeHtml(label)} AI招投标信息">
          <div class="section-heading"><div><span class="section-index">当日信息</span><h2>由近到远</h2></div><span class="sort-label"><span class="sort-dot"></span>时间 ↓</span></div>
          <div class="feed-list">${rows.map((row, rowIndex) => feedItemHtml(date, row, rowIndex)).join('')}</div>
          <nav class="archive-pagination" aria-label="日期导航">${navigation}</nav>
        </section>
      </main>
      <footer class="footer"><span>${SITE_NAME}</span><nav class="footer-links" aria-label="页脚导航"><a href="/">最新信息</a><a href="/about/">关于</a></nav></footer>
    </div>
  </body>
</html>
`;
}

async function injectHomepageFeed(publicDir, snapshot) {
  const indexPath = path.join(publicDir, 'index.html');
  let html = await readFile(indexPath, 'utf8');
  const rows = snapshot.rows || [];
  const staticFeed = rows.slice(0, 40).map((row, index) => feedItemHtml(snapshot.date, row, index)).join('\n');
  const start = '<!-- STATIC_FEED_START -->';
  const end = '<!-- STATIC_FEED_END -->';
  if (!html.includes(start) || !html.includes(end)) throw new Error('首页缺少静态信息流注入标记。');
  html = html.replace(new RegExp(`${start}[\\s\\S]*?${end}`), `${start}\n${staticFeed}\n            ${end}`);
  html = html.replace(/<h2 id="feed-title">[\s\S]*?<\/h2>/u, `<h2 id="feed-title">${snapshot.date.replaceAll('-', '.')}</h2>`);
  html = html.replace(/<strong id="stat-total">[\s\S]*?<\/strong>/u, `<strong id="stat-total">${rows.length.toLocaleString('zh-CN')}</strong>`);
  html = html.replace(/<strong id="stat-amount">[\s\S]*?<\/strong>/u, `<strong id="stat-amount">${rows.filter((row) => row.budgetText || row.winnerAmountText).length.toLocaleString('zh-CN')}</strong>`);
  html = html.replace(/<strong id="stat-result">[\s\S]*?<\/strong>/u, `<strong id="stat-result">${rows.filter((row) => /中标|成交|结果/u.test(row.noticeType || '')).length.toLocaleString('zh-CN')}</strong>`);
  html = html.replace(/<span id="feed-count">[\s\S]*?<\/span>/u, `<span id="feed-count">${rows.length.toLocaleString('zh-CN')} 条记录</span>`);
  await writeFile(indexPath, html);
}

export async function buildSeoArtifacts(repoDir, snapshots) {
  const publicDir = path.join(repoDir, 'public');
  const tenderDir = path.join(publicDir, 'tenders');
  const archiveDir = path.join(publicDir, 'date');
  await rm(tenderDir, { recursive: true, force: true });
  await rm(archiveDir, { recursive: true, force: true });
  await mkdir(tenderDir, { recursive: true });
  await mkdir(archiveDir, { recursive: true });

  const preparedSnapshots = snapshots
    .map((snapshot) => ({ ...snapshot, rows: dedupeTenderRows(snapshot.date, snapshot.rows || []) }))
    .sort((left, right) => right.date.localeCompare(left.date));
  const orderedDates = preparedSnapshots.map((snapshot) => snapshot.date);

  const urls = [];
  const seenUrls = new Set();
  for (const snapshot of preparedSnapshots) {
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
    const dateOutputDir = path.join(archiveDir, date);
    await mkdir(dateOutputDir, { recursive: true });
    await writeFile(path.join(dateOutputDir, 'index.html'), archiveHtml(snapshot, snapshot.rows || [], orderedDates));
  }

  const latestSnapshot = preparedSnapshots[0];
  if (latestSnapshot) await injectHomepageFeed(publicDir, latestSnapshot);
  const latestDate = latestSnapshot?.date || new Date().toISOString().slice(0, 10);
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE_ORIGIN}/</loc><lastmod>${latestDate}</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>
  <url><loc>${SITE_ORIGIN}/about/</loc><lastmod>${ABOUT_LASTMOD}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
${preparedSnapshots.map(({ date }) => `  <url><loc>${dateUrl(date)}</loc><lastmod>${date}</lastmod><changefreq>daily</changefreq><priority>0.9</priority></url>`).join('\n')}
${urls.map(({ url, lastmod }) => `  <url><loc>${escapeXml(url)}</loc><lastmod>${lastmod}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>`).join('\n')}
</urlset>
`;
  await writeFile(path.join(publicDir, 'sitemap.xml'), sitemap);
  await writeFile(path.join(publicDir, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`);
  return { detailCount: urls.length, archiveCount: preparedSnapshots.length };
}
