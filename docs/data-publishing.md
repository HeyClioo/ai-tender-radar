# Daily data publishing

The public repository is the content source for the deployed site. The private collector publishes a sanitized snapshot after a successful run:

```text
private n8n run
  -> data/raw/<run>.json
  -> public repository public/data/snapshots/<date>.json
  -> public/data/dates.json
  -> git commit + git push
  -> vercel --prod
```

The public repository never receives the private collector's browser profile, cookies, Feishu credentials, SQLite state, or raw response payloads.

## Private collector settings

In the private n8n environment, set:

```dotenv
PUBLIC_FEED_ENABLED=true
PUBLIC_FEED_REPO_DIR=/Users/cathy/Documents/ai-tender-radar
PUBLIC_FEED_PUBLISHER_SCRIPT=/Users/cathy/Documents/ai-tender-radar/scripts/publish-snapshot.mjs
PUBLIC_FEED_DEPLOY_VERCEL=true
```

The next successful daily run will publish the selected date, push `main`, and deploy the same repository to Vercel. Keep these settings in the private `.env`, never in the public repository.
