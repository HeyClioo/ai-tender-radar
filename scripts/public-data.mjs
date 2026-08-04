import { readFile } from 'node:fs/promises';

export const PUBLIC_ROW_KEYS = [
  'title', 'visibleSummary', 'noticeType', 'region', 'buyer', 'agency',
  'projectNo', 'budgetText', 'winnerAmountText', 'publishText', 'categories',
];

export const PROHIBITED_KEYS = [
  'appSecret', 'app_id', 'appId', 'access_token', 'refresh_token', 'cookie',
  'cookies', 'browserProfile', 'profileDir', 'password', 'authorization',
];

export async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

export function snapshotDate(payload) {
  const date = String(payload?.filters?.date ?? payload?.date ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('快照缺少合法的 YYYY-MM-DD 日期。');
  return date;
}

export function sanitizeRow(row) {
  return Object.fromEntries(PUBLIC_ROW_KEYS.map((key) => {
    const value = row?.[key];
    if (key === 'categories') return [key, Array.isArray(value) ? value.map(String) : []];
    return [key, value == null ? '' : String(value)];
  }));
}

export function sanitizeSnapshot(payload) {
  const date = snapshotDate(payload);
  const rows = Array.isArray(payload?.rows) ? payload.rows.map(sanitizeRow) : [];
  return {
    date,
    runAt: String(payload.runAt ?? ''),
    capturedAt: String(payload.capturedAt ?? ''),
    filters: {
      keyword: String(payload.filters?.keyword ?? 'AI'),
      region: String(payload.filters?.region ?? '全国'),
      publishTime: String(payload.filters?.publishTime ?? '近7天'),
      sort: String(payload.filters?.sort ?? '发布时间从近到远'),
    },
    rows,
  };
}

export function findProhibitedValues(value, location = '$') {
  const findings = [];
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (PROHIBITED_KEYS.some((prohibited) => key.toLowerCase().includes(prohibited.toLowerCase()))) {
        findings.push(`${location}.${key}`);
      }
      findings.push(...findProhibitedValues(child, `${location}.${key}`));
    }
  } else if (typeof value === 'string' && /(cli_[a-z0-9]{10,}|sk-[a-z0-9_-]{10,}|bearer\s+[a-z0-9._-]{10,})/i.test(value)) {
    findings.push(location);
  }
  return findings;
}
