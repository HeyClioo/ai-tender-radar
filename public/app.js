import { copyTitle } from './copy-title.js';

const state = {
  rows: [],
  filtered: [],
  visible: 20,
  type: '',
  query: '',
  amountOnly: false,
  meta: {},
  availableDates: [],
  date: '',
};

const $ = (selector) => document.querySelector(selector);
const setText = (selector, value) => { const node = $(selector); if (node) node.textContent = value; };
const typeColors = (type) => {
  if (/中标|成交|结果/.test(type)) return 'result';
  if (/意向/.test(type)) return 'intent';
  return '';
};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function amountInfo(row) {
  const winner = String(row.winnerAmountText ?? '').trim();
  const budget = String(row.budgetText ?? '').trim();
  const raw = winner || budget;
  if (!raw) return { label: '金额', value: '未披露', hasAmount: false };
  const number = raw.match(/(\d+(?:\.\d+)?)\s*(万亿|亿元|万元|千元|元)?/);
  if (!number) return { label: winner ? '中标' : '预算', value: raw.replace(/^(预算|中标|成交)(金额)?[：:]?\s*/, ''), hasAmount: true };
  const numeric = Number(number[1]);
  const unit = number[2] || '元';
  const multiplier = { '万亿': 1e12, '亿元': 1e8, '万元': 1e4, '千元': 1e3, '元': 1 }[unit] || 1;
  const yuan = numeric * multiplier;
  let display;
  if (yuan >= 1e8) display = `${(yuan / 1e8).toFixed(yuan % 1e8 ? 2 : 0)} 亿`;
  else if (yuan >= 1e4) display = `${(yuan / 1e4).toFixed(yuan % 1e4 ? 2 : 0)} 万`;
  else display = `${Math.round(yuan).toLocaleString('zh-CN')}`;
  return { label: winner ? '中标' : '预算', value: display, hasAmount: true };
}

function displayDate(text) {
  const value = String(text ?? '').trim();
  const match = value.match(/(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})/);
  if (match) return `${match[2].padStart(2, '0')}.${match[3].padStart(2, '0')}`;
  if (/刚刚/.test(value)) return '刚刚';
  if (/(分钟前|小时前)/.test(value)) return value;
  return value || '—';
}

function dateLabel(date) {
  const match = String(date ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[1]}.${match[2]}.${match[3]}` : date || '—';
}

function tenderId(date, row) {
  const source = [date, row?.projectNo, row?.title, row?.buyer, row?.region].map((value) => String(value ?? '')).join('|');
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function tenderPath(row) {
  return `/tenders/${state.date}/${tenderId(state.date, row)}/`;
}

function renderTypeFilters() {
  const container = $('#type-filters');
  const types = [...new Set(state.rows.map((row) => row.noticeType).filter(Boolean))];
  const preferred = ['招标公告', '中标通知', '中标公告', '成交公告', '采购意向', '结果公告'];
  const ordered = [...preferred.filter((type) => types.includes(type)), ...types.filter((type) => !preferred.includes(type))];
  container.innerHTML = [`<button class="filter-pill${state.type ? '' : ' active'}" data-type="" type="button">全部</button>`, ...ordered.slice(0, 6).map((type) => `<button class="filter-pill${state.type === type ? ' active' : ''}" data-type="${escapeHtml(type)}" type="button">${escapeHtml(type.replace('公告', ''))}</button>`)].join('');
  container.onclick = (event) => {
    const button = event.target.closest('[data-type]');
    if (!button) return;
    state.type = button.dataset.type;
    [...container.children].forEach((item) => item.classList.toggle('active', item === button));
    applyFilters();
  };
}

function applyFilters() {
  const query = state.query.toLowerCase();
  state.filtered = state.rows.filter((row) => {
    const searchable = [row.title, row.visibleSummary, row.buyer, row.region, row.noticeType].map((value) => String(value ?? '').toLowerCase()).join(' ');
    if (query && !searchable.includes(query)) return false;
    if (state.type && row.noticeType !== state.type) return false;
    if (state.amountOnly && !row.budgetText && !row.winnerAmountText) return false;
    return true;
  });
  state.visible = 20;
  renderFeed();
}

function rowMarkup(row, index) {
  const amount = amountInfo(row);
  const type = escapeHtml(row.noticeType || '未分类');
  const summary = escapeHtml(row.visibleSummary || '页面未提供正文摘要。');
  const buyer = escapeHtml(row.buyer || row.agency || '采购单位未披露');
  const region = escapeHtml(row.region || '全国');
  return `<a class="feed-item" data-index="${index}" href="${tenderPath(row)}" aria-label="查看：${escapeHtml(row.title)}">
    <div class="item-time">${escapeHtml(displayDate(row.publishText))}</div>
    <div class="item-main"><div class="item-kicker"><span class="type-badge ${typeColors(type)}">${type}</span><span>${region}</span></div><h3>${escapeHtml(row.title)}</h3><p>${summary}</p><div class="item-meta"><strong>${buyer}</strong>${row.projectNo ? ` <span>· ${escapeHtml(row.projectNo)}</span>` : ''}</div></div>
    <div class="item-amount ${amount.hasAmount ? 'has-amount' : 'empty'}">${amount.hasAmount ? `<span>${amount.label}</span><strong>${escapeHtml(amount.value)}</strong><small>人民币</small>` : ''}</div>
    <span class="item-open" aria-hidden="true">↗</span>
  </a>`;
}

function renderFeed() {
  const list = $('#feed-list');
  const visible = state.filtered.slice(0, state.visible);
  if (!visible.length) {
    list.innerHTML = '<div class="empty-state">没有符合条件的记录。换一个关键词，或清除筛选。</div>';
  } else {
    list.innerHTML = visible.map((row) => rowMarkup(row, state.rows.indexOf(row))).join('');
    list.querySelectorAll('.feed-item').forEach((item) => {
      item.addEventListener('click', (event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        openDetail(state.rows[Number(item.dataset.index)]);
      });
    });
  }
  setText('#feed-count', `${state.filtered.length.toLocaleString('zh-CN')} 条记录`);
  $('#load-more').hidden = state.visible >= state.filtered.length;
}

function openDetail(row) {
  const amount = amountInfo(row);
  const amountMeta = amount.hasAmount ? `<div><span>${amount.label}</span><strong class="amount-highlight">${escapeHtml(amount.value)} 人民币</strong></div>` : '';
  $('#dialog-content').innerHTML = `<div class="dialog-kicker"><span class="type-badge ${typeColors(row.noticeType)}">${escapeHtml(row.noticeType || '未分类')}</span><span>${escapeHtml(row.region || '全国')}</span><span>${escapeHtml(row.publishText || dateLabel(state.date))}</span></div><div class="dialog-title-row"><h2 class="dialog-title">${escapeHtml(row.title)}</h2><button class="copy-title-button" type="button" aria-label="复制标题" title="复制标题"><svg class="copy-icon-copy" viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="1"></rect><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"></path></svg><svg class="copy-icon-check" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"></path></svg></button></div><div class="dialog-body">${escapeHtml(row.visibleSummary || '页面未提供正文摘要。')}</div><div class="dialog-meta"><div><span>采购单位</span><strong>${escapeHtml(row.buyer || '未披露')}</strong></div>${amountMeta}<div><span>项目编号</span><strong>${escapeHtml(row.projectNo || '未披露')}</strong></div><div><span>分类</span><strong>${escapeHtml((row.categories || []).join(' / ') || '未分类')}</strong></div></div>`;
  const copyButton = $('#dialog-content .copy-title-button');
  copyButton.addEventListener('click', async () => {
    try {
      await copyTitle(row.title);
      copyButton.classList.add('copied');
      copyButton.setAttribute('aria-label', '标题已复制');
      copyButton.title = '标题已复制';
      window.setTimeout(() => {
        copyButton.classList.remove('copied');
        copyButton.setAttribute('aria-label', '复制标题');
        copyButton.title = '复制标题';
      }, 1600);
    } catch {
      copyButton.setAttribute('aria-label', '复制失败');
      copyButton.title = '复制失败';
    }
  });
  const dialog = $('#detail-dialog');
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
}

function updateDateControls() {
  const select = $('#date-select');
  const dates = state.availableDates;
  select.innerHTML = dates.length ? dates.map((item) => `<option value="${escapeHtml(item.date)}">${escapeHtml(dateLabel(item.date))} · ${Number(item.count || 0).toLocaleString('zh-CN')} 条</option>`).join('') : '<option value="">暂无日期</option>';
  select.value = state.date;
  const index = dates.findIndex((item) => item.date === state.date);
  $('#prev-date').disabled = index < 0 || index >= dates.length - 1;
  $('#next-date').disabled = index <= 0;
}

function updateStats() {
  const rows = state.rows;
  const amount = rows.filter((row) => row.budgetText || row.winnerAmountText).length;
  const result = rows.filter((row) => /中标|成交|结果/.test(row.noticeType || '')).length;
  setText('#stat-total', rows.length.toLocaleString('zh-CN'));
  setText('#stat-amount', amount.toLocaleString('zh-CN'));
  setText('#stat-result', result.toLocaleString('zh-CN'));
  setText('#feed-title', dateLabel(state.date || state.meta.date));
}

async function loadDates() {
  const response = await fetch('/data/dates.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('Dates unavailable');
  const payload = await response.json();
  state.availableDates = Array.isArray(payload.dates) ? payload.dates : [];
  state.date = payload.currentDate || state.availableDates[0]?.date || '';
  updateDateControls();
}

async function loadData() {
  try {
    if (!state.date) throw new Error('No date selected');
    const response = await fetch(`/data/snapshots/${encodeURIComponent(state.date)}.json`, { cache: 'no-store' });
    if (!response.ok) throw new Error('API unavailable');
    const payload = await response.json();
    state.rows = payload.rows || [];
    state.meta = payload.meta || {};
  } catch (error) {
    $('#feed-list').innerHTML = '<div class="empty-state">当前日期的数据暂不可用。</div>';
    setText('#feed-count', '数据离线');
    return;
  }
  renderTypeFilters();
  updateStats();
  applyFilters();
  updateDateControls();
}

function resetFiltersForDate() {
  state.type = '';
  state.query = '';
  state.amountOnly = false;
  $('#search-input').value = '';
  $('#amount-toggle').classList.remove('active');
  $('#amount-toggle').setAttribute('aria-pressed', 'false');
}

async function switchDate(date) {
  state.date = date;
  resetFiltersForDate();
  updateDateControls();
  await loadData();
}

$('#search-input').addEventListener('input', (event) => { state.query = event.target.value; applyFilters(); });
$('#amount-toggle').addEventListener('click', (event) => { state.amountOnly = !state.amountOnly; event.currentTarget.classList.toggle('active', state.amountOnly); event.currentTarget.setAttribute('aria-pressed', String(state.amountOnly)); applyFilters(); });
$('#load-more').addEventListener('click', () => { state.visible += 20; renderFeed(); });
$('#focus-search').addEventListener('click', () => $('#search-input').focus());
$('#date-select').addEventListener('change', async (event) => { await switchDate(event.target.value); });
$('#prev-date').addEventListener('click', async () => {
  const index = state.availableDates.findIndex((item) => item.date === state.date);
  if (index >= 0 && index < state.availableDates.length - 1) await switchDate(state.availableDates[index + 1].date);
});
$('#next-date').addEventListener('click', async () => {
  const index = state.availableDates.findIndex((item) => item.date === state.date);
  if (index > 0) await switchDate(state.availableDates[index - 1].date);
});
$('#close-dialog').addEventListener('click', () => $('#detail-dialog').close());
$('#detail-dialog').addEventListener('click', (event) => { if (event.target === event.currentTarget) event.currentTarget.close(); });
window.addEventListener('keydown', (event) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); $('#search-input').focus(); } if (event.key === 'Escape' && $('#detail-dialog').open) $('#detail-dialog').close(); });

(async () => {
  try {
    await loadDates();
    await loadData();
  } catch {
    $('#feed-list').innerHTML = '<div class="empty-state">信息日期暂不可用，请稍后再试。</div>';
    setText('#feed-count', '数据离线');
  }
})();
