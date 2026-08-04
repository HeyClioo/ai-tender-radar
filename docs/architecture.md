# Architecture

## Public repository boundary

The repository contains the deployed read-only web interface and sanitized JSON snapshots. It does not contain the collector's browser session, Feishu credentials, n8n workflow state, or raw anti-bot responses.

## Snapshot contract

Each file under `data/snapshots/` is named `YYYY-MM-DD.json` and contains:

```json
{
  "date": "2026-08-03",
  "runAt": "2026-08-04T01:00:51.968Z",
  "capturedAt": "2026-08-04T01:02:05.516Z",
  "filters": {
    "keyword": "AI",
    "region": "全国",
    "publishTime": "近7天",
    "sort": "发布时间从近到远"
  },
  "rows": []
}
```

The browser reads `data/dates.json`, then loads the selected snapshot directly from `/data/snapshots/<date>.json`. This keeps Vercel deployment static and makes every displayed date inspectable in Git history.

## Update lifecycle

1. A private collector obtains the visible public rows.
2. The publisher keeps only the declared public fields.
3. The date index is regenerated and the repository validator runs.
4. The snapshot and index are committed to GitHub.
5. Vercel deploys the new `main` commit.
