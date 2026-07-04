---
name: prs
description: "Dashboard of open PRs with CI status, links, and deploy state."
argument-hint: ""
---

Show a dashboard of all open PRs and recent deploy status.

## Steps

### 1. Open PRs

```bash
gh pr list --json number,title,url,headRefName,baseRefName,createdAt,isDraft,autoMergeRequest --jq '.'
```

### 2. CI Status for Each PR

For each open PR:
```bash
gh pr checks <number> --json name,state,conclusion --jq '.'
```

### 3. Recent Deploy Runs

```bash
gh run list --workflow=staging.yml --limit 5 --json conclusion,displayTitle,createdAt,url
```

### 4. Display Dashboard

```
## PR Dashboard — eulard

### Open PRs
| # | Title | Branch → Base | Status | Auto-merge |
|---|-------|---------------|--------|------------|

### Recent Dev Deploys
| Status | Commit | When |
|--------|--------|------|

### Quick Actions
- `/ship` — push & create PR from current branch
- `/merge <number>` — merge a specific PR
```

Note: eulard currently has no stable/prod branch. Production is deployed via GKE scripts (`scripts/deploy.sh`).
