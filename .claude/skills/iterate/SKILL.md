---
name: iterate
description: "Fast dev iteration: validate locally, commit, push, deploy eulard via gcloud. No CI."
argument-hint: "[commit message or empty for auto-generated]"
---

> **Dev iteration only.** This skill pushes to main and deploys to the dev environment. For production releases, use `/release [major|minor|patch]`.

Fastest path from code change to deployed. Validates locally, commits, pushes, and deploys via local gcloud.

## Steps

### 1. Validate (fail fast)

```bash
cd ~/eulard && pnpm exec tsc --noEmit
```

If it fails, STOP and show errors.

### 2. Stage and Commit

```bash
cd ~/eulard && git add -A && git status --short
```

If `$ARGUMENTS` is provided, use it as the commit message. Otherwise auto-generate from the diff.

```bash
cd ~/eulard && git commit -m "<message>"
```

If nothing to commit, skip to step 4.

### 3. Push

```bash
cd ~/eulard && git push origin main
```

### 4. Deploy

```bash
cd ~/eulard
SHA=$(git rev-parse --short HEAD)
gcloud builds submit \
  --config=cloudbuild-staging.yaml \
  --substitutions="_TAG=staging-${SHA}" \
  --project=kelihi-ai-platform .
```

### 5. Report

```
Deployed eulard to dev.
- Commit: <sha> <message>
- URL: https://eulard.kelihi.com
```
