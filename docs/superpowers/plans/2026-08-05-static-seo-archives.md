# Static SEO Archives Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the daily AI tender feed directly crawlable without JavaScript, add date archive pages, and improve canonical detail-page quality without adding reader-facing filler.

**Architecture:** Add one browser-and-Node-compatible data helper for stable IDs, duplicate merging, and summary cleanup. Extend the existing static SEO generator to inject a latest-date feed seed into the homepage and generate one archive page per date; detail pages and the interactive feed consume the same merged records so URLs and displayed content stay consistent.

**Tech Stack:** Node.js ESM, static HTML/CSS/JavaScript, Node test runner, Vercel static hosting.

---

### Task 1: Specify shared record normalization

**Files:**
- Create: `public/tender-data.js`
- Create: `test/tender-data.test.mjs`

- [ ] **Step 1: Write the failing tests**

```js
test('duplicate rows merge into the richest public record', () => {
  const rows = dedupeTenderRows('2026-08-04', [attachmentOnly, fullNotice]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].noticeType, '招标公告');
  assert.match(rows[0].visibleSummary, /完整采购范围/);
  assert.deepEqual(rows[0].categories, ['服务', '教育']);
});

test('repeated leading titles are removed from summaries', () => {
  assert.equal(cleanTenderSummary('AI项目询比公告', 'AI项目询比公告AI项目询比公告采购范围如下。'), '采购范围如下。');
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `node --test test/tender-data.test.mjs`

Expected: FAIL because `public/tender-data.js` does not exist.

- [ ] **Step 3: Implement stable IDs, cleanup, merging, and deduplication**

```js
export function tenderId(date, row) { /* current FNV-1a implementation */ }
export function cleanTenderSummary(title, summary) { /* remove repeated leading title and attachment prefix */ }
export function mergeTenderRows(rows) { /* retain richest summary and fill missing public fields */ }
export function dedupeTenderRows(date, rows) { /* group by tenderId while preserving first-seen order */ }
```

- [ ] **Step 4: Run the focused and full tests**

Run: `node --test test/tender-data.test.mjs && npm test`

Expected: all tests pass.

### Task 2: Specify crawlable homepage and date archives

**Files:**
- Modify: `test/seo.test.mjs`
- Modify: `public/index.html`
- Modify: `scripts/seo.mjs`

- [ ] **Step 1: Add failing SEO generator assertions**

```js
assert.match(homeHtml, /href="\/tenders\/2026-08-03\//);
assert.match(homeHtml, /某高校AI助教智能体采购项目/);
assert.equal(existsSync(path.join(repoDir, 'public/date/2026-08-03/index.html')), true);
assert.match(dateHtml, /<link rel="canonical" href="https:\/\/ai-tender-radar\.vercel\.app\/date\/2026-08-03\/">/);
assert.match(sitemap, /<loc>https:\/\/ai-tender-radar\.vercel\.app\/date\/2026-08-03\/<\/loc>/);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test test/seo.test.mjs`

Expected: FAIL because the homepage has no tender anchors and the date archive does not exist.

- [ ] **Step 3: Add stable homepage injection markers**

```html
<div class="feed-list" id="feed-list" aria-live="polite">
  <!-- STATIC_FEED_START -->
  <!-- STATIC_FEED_END -->
</div>
```

- [ ] **Step 4: Generate the latest homepage seed and every date archive**

```js
await injectHomepageFeed(publicDir, latestSnapshot);
await writeFile(path.join(publicDir, 'date', date, 'index.html'), dateArchiveHtml(snapshot, mergedRows, dates));
```

The homepage seed contains the latest 40 canonical rows. Each archive lists all canonical rows, provides previous/next date links, `CollectionPage` and `ItemList` JSON-LD, and a self canonical URL.

- [ ] **Step 5: Add archive URLs to the sitemap and run tests**

Run: `node --test test/seo.test.mjs && npm test`

Expected: all tests pass; sitemap includes homepage, About, date archives, and detail pages.

### Task 3: Improve detail descriptions and internal links

**Files:**
- Modify: `test/seo.test.mjs`
- Modify: `scripts/seo.mjs`
- Modify: `public/app.js`
- Modify: `public/styles.css`

- [ ] **Step 1: Add failing assertions for clean descriptions and date breadcrumbs**

```js
assert.doesNotMatch(description, /AI助教智能体采购项目AI助教智能体采购项目/);
assert.match(html, /href="\/date\/2026-08-03\/">2026年8月3日<\/a>/);
assert.match(html, /"position":2,"name":"2026年8月3日","item":"https:\/\/ai-tender-radar\.vercel\.app\/date\/2026-08-03\/"/);
```

- [ ] **Step 2: Verify RED**

Run: `node --test test/seo.test.mjs`

Expected: FAIL because date breadcrumbs currently point to the detail URL and summaries are not normalized.

- [ ] **Step 3: Consume shared merged records everywhere**

```js
import { cleanTenderSummary, dedupeTenderRows, tenderId } from './tender-data.js';
state.rows = dedupeTenderRows(state.date, payload.rows || []);
```

Use the cleaned summary for the interactive cards, modal, meta description, and visible detail body. Point visible and JSON-LD breadcrumbs to `/date/YYYY-MM-DD/`.

- [ ] **Step 4: Add restrained archive styling**

Reuse the existing editorial feed styles, with only archive header/navigation additions. No new marketing copy, cards, gradients, or decorative modules.

- [ ] **Step 5: Run focused and full tests**

Run: `node --test test/tender-data.test.mjs test/seo.test.mjs && npm test`

Expected: all tests pass.

### Task 4: Regenerate and verify production artifacts

**Files:**
- Regenerate: `public/data/dates.json`
- Regenerate: `public/index.html`
- Regenerate: `public/date/**/index.html`
- Regenerate: `public/tenders/**/index.html`
- Regenerate: `public/sitemap.xml`

- [ ] **Step 1: Rebuild all artifacts**

Run: `npm run build:data`

Expected: two date archives and canonical detail pages are generated without prohibited public fields.

- [ ] **Step 2: Run complete automated verification**

Run: `npm test && npm run validate`

Expected: zero failures and public-data validation passes.

- [ ] **Step 3: Serve and inspect representative pages**

Run: `npm run dev`

Inspect `/`, `/date/2026-08-04/`, and one `/tenders/2026-08-04/.../` URL at desktop and mobile widths. Confirm the homepage works before JavaScript and the interactive filters still work after JavaScript.

- [ ] **Step 4: Review generated links and metadata**

Run: `curl`, HTML assertions, and sitemap URL counts against the local server.

Expected: static tender anchors exist, archive URLs return 200, canonical and breadcrumb URLs agree, and nonexistent URLs return 404.

### Task 5: Publish and verify live SEO endpoints

**Files:**
- Commit only reviewed repository changes.

- [ ] **Step 1: Review the diff and secret scan**

Run: `git status --short && git diff --stat && git diff --check && npm run validate`

Expected: no unrelated files, whitespace errors, or prohibited values.

- [ ] **Step 2: Commit and push the intended changes**

```bash
git add public scripts test docs/superpowers/plans/2026-08-05-static-seo-archives.md
git commit -m "feat: add crawlable daily tender archives"
git push origin main
```

- [ ] **Step 3: Deploy to Vercel**

Run: `vercel --prod --yes`

Expected: production alias updates to `https://ai-tender-radar.vercel.app`.

- [ ] **Step 4: Verify live responses**

Check homepage, latest date archive, representative detail page, robots, and sitemap for HTTP 200, expected canonical URLs, static tender anchors, and new sitemap counts.
