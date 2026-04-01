---
name: deploy
description: "Validate locally, commit, push, and deploy eulard to dev via gcloud. For prod, use /release."
argument-hint: "[dev] (default: dev)"
---

Deploy eulard to GCP dev environment via local gcloud. Validates first, then builds and deploys.

For production releases, use `/release [major|minor|patch]` to cut a versioned release with changelog and PR to stable.

## Steps

### 1. Validate Locally (fail fast)

```bash
cd ~/eulard && pnpm install --frozen-lockfile
cd ~/eulard && pnpm lint
cd ~/eulard && pnpm exec tsc --noEmit
cd ~/eulard && pnpm build
```

If any check fails, STOP and show errors.

### 2. Stage and Commit

```bash
cd ~/eulard && git add -A && git status --short
```

If changes exist, auto-generate a commit message and commit:

```bash
cd ~/eulard && git commit -m "<message>"
```

### 3. Push

```bash
cd ~/eulard && git push origin main
```

### 4. Deploy via gcloud (dev)

```bash
cd ~/eulard
SHA=$(git rev-parse --short HEAD)
gcloud builds submit \
  --config=cloudbuild-staging.yaml \
  --substitutions="_TAG=staging-${SHA}" \
  --project=kelihi-ai-platform .
```

### 5. Prod deployment

Do NOT deploy to prod directly from this skill. Instead, tell the user:

> For production releases, use `/release [major|minor|patch]` to cut a versioned release with changelog and PR to stable.

### 6. Report

```
Deployed eulard to dev.
- Commit: <sha>
- URL: https://dev.eulard.kelihi.com
```
