---
name: merge
description: "Check status and merge a PR to main."
argument-hint: "<PR number or URL>"
---

Merge a pull request after checking status.

## Steps

### 1. Identify the PR

Parse $ARGUMENTS to get the PR number. Accept:
- A number: `42`
- A URL: `https://github.com/kelihi/eulard/pull/42`
- Empty: find the PR for the current branch

```bash
gh pr list --head $(git branch --show-current) --json number,url,title,baseRefName --jq '.[0]'
```

### 2. Show PR Details

```bash
gh pr view <number> --json title,url,baseRefName,headRefName,state,mergeable,statusCheckRollup
```

### 3. Check CI Status

```bash
gh pr checks <number>
```

### 4. Merge

```bash
gh pr merge <number> --squash
```

No `--admin` needed since eulard has no branch protection on main.

### 5. Report

```
## ✅ Merged

**PR**: #<number> — <title>
**URL**: <url>
**Merged**: <head> → main

**What happens next**:
- `deploy-dev.yml` triggers — builds + deploys to Cloud Run dev (~5 min)
- Dev site: https://dev.eulard.kelihi.com

**Track deploy**: `gh run list --workflow=deploy-dev.yml --limit 1`
```

## Edge Cases

- **PR not found**: list open PRs with `gh pr list` and show them
- **Merge conflicts**: show the conflict and suggest resolution
- **Already merged**: just report it
