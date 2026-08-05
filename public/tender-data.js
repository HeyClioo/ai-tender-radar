const SCALAR_FIELDS = [
  'title', 'noticeType', 'region', 'buyer', 'agency', 'projectNo',
  'budgetText', 'winnerAmountText', 'publishText',
];

function text(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

export function tenderId(date, row) {
  const source = [date, row?.projectNo, row?.title, row?.buyer, row?.region]
    .map((value) => String(value ?? ''))
    .join('|');
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function cleanTenderSummary(title, summary) {
  const original = text(summary);
  if (!original) return '';

  let cleaned = original.replace(/^点击查看公告内容\s*[：:]\s*/u, '').trim();
  const attachmentName = cleaned;
  const normalizedTitle = text(title);
  if (normalizedTitle) {
    while (cleaned.startsWith(normalizedTitle)) {
      cleaned = cleaned.slice(normalizedTitle.length).replace(/^[\s:：|｜·—-]+/u, '').trim();
    }
  }
  if (/^\.(?:pdf|docx?|xlsx?)$/iu.test(cleaned)) return attachmentName;
  return cleaned || original;
}

function summaryScore(row) {
  const summary = cleanTenderSummary(row?.title, row?.visibleSummary);
  const attachmentPenalty = /\.(?:pdf|docx?|xlsx?)$/iu.test(summary) ? 1000 : 0;
  return summary.length - attachmentPenalty;
}

function bestScalar(rows, key, fallback = '') {
  const candidates = rows.map((row) => text(row?.[key])).filter(Boolean);
  if (!candidates.length) return fallback;
  if (key === 'publishText') {
    return [...candidates].sort((left, right) => {
      const leftAbsolute = /20\d{2}[-/.年]/u.test(left) ? 1 : 0;
      const rightAbsolute = /20\d{2}[-/.年]/u.test(right) ? 1 : 0;
      return rightAbsolute - leftAbsolute || right.length - left.length;
    })[0];
  }
  return [...candidates].sort((left, right) => right.length - left.length)[0];
}

export function mergeTenderRows(rows) {
  if (!Array.isArray(rows) || !rows.length) return null;
  const richest = [...rows].sort((left, right) => summaryScore(right) - summaryScore(left))[0];
  const merged = { ...richest };
  for (const key of SCALAR_FIELDS) merged[key] = bestScalar(rows, key, text(richest?.[key]));
  merged.visibleSummary = cleanTenderSummary(merged.title, richest?.visibleSummary);
  merged.categories = [...new Set(rows.flatMap((row) => (
    Array.isArray(row?.categories) ? row.categories.map(text).filter(Boolean) : []
  )))];
  return merged;
}

export function dedupeTenderRows(date, rows) {
  const groups = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const id = tenderId(date, row);
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(row);
  }
  return [...groups.values()].map(mergeTenderRows).filter(Boolean);
}
