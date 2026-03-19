---
name: ship
description: "Push branch, create PR to main with auto-merge enabled, and show CI status."
argument-hint: "[PR title or empty for auto-generated]"
---

Ship the current branch to main via PR with auto-merge.

## Prerequisites

- You must be on a feature branch (not `main`)
- All changes must be committed

## Steps

### 1. Validate State

```bash
BRANCH=$(git branch --show-current)
git status
```

If on `main`, STOP and tell the user to create a feature branch first.
If there are uncommitted changes, STOP and ask the user to commit first.

### 2. Push Branch

```bash
git push -u origin $BRANCH
```

### 3. Check for Existing PR

```bash
gh pr list --head $BRANCH --json number,url,state --jq '.[] | select(.state=="OPEN")'
```

If a PR already exists, skip creation and just enable auto-merge on it.

### 4. Create PR

Generate a title from the branch name or use $ARGUMENTS if provided.
Review the full diff against main to write the PR body.

```bash
git log main..HEAD --oneline
git diff main...HEAD --stat
```

Create the PR:

```bash
gh pr create --base main --title "<title>" --body "$(cat <<'EOF'
## Summary
<bullet points summarizing changes>

## Test plan
- [ ] Local dev server works
- [ ] Diagram rendering not broken
- [ ] AI chat functional

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

### 5. Enable Auto-Merge

```bash
gh pr merge <number> --auto --squash
```

Note: eulard currently has no required status checks on main, so auto-merge will proceed immediately after enabling. If you want to review first, skip this step and use `/merge` manually.

### 6. Report

```
## 🚀 Shipped

**PR**: <title>
**URL**: https://github.com/kelihi/eulard/pull/<number>
**Branch**: <branch> → main
**Auto-merge**: Enabled

**What happens next**:
1. PR merges (no required checks currently)
2. `deploy-dev.yml` triggers — builds + deploys to Cloud Run dev
3. Dev site: https://dev.eulard.kelihi.com

**If you need to check later**: `/prs`
```

## Error Handling

- If `gh pr create` fails because a PR already exists, find and reuse it
- If push fails, suggest `git pull --rebase origin main` first
