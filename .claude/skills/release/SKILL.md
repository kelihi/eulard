---
name: release
description: "Cut a semver release: bump version, generate changelog, tag, push, and open PR to stable."
argument-hint: "[major|minor|patch] (default: patch)"
---

Cut a release of eulard. Bumps version, generates changelog from commits, tags, pushes, and opens a PR from main to stable.

Do ALL steps autonomously without asking for confirmation.

## Steps

### 1. Validate State

```bash
cd ~/eulard && git status --porcelain
```

If there are uncommitted changes, STOP and tell the user to commit or stash first.

```bash
cd ~/eulard && git branch --show-current
```

If not on `main`, STOP and tell the user to switch to main first.

### 2. Pull Latest

```bash
cd ~/eulard && git pull origin main
```

### 3. Determine Bump Type

Parse `$ARGUMENTS` for `major`, `minor`, or `patch`. Default to `patch` if empty or unrecognized.

### 4. Read Current Version

```bash
cd ~/eulard && node -p "require('./package.json').version"
```

### 5. Compute Next Version

Split the current version into `major.minor.patch` and increment the appropriate segment:
- `major` — increment major, reset minor and patch to 0
- `minor` — increment minor, reset patch to 0
- `patch` — increment patch

### 6. Gather Commits Since Last Tag

```bash
cd ~/eulard && git log $(git describe --tags --abbrev=0 2>/dev/null || git rev-list --max-parents=0 HEAD)..HEAD --oneline --no-decorate
```

If there are no commits since the last tag, STOP and tell the user there is nothing to release.

### 7. Generate Changelog Section

Categorize each commit by its prefix. Recognized prefixes and their display names:

| Prefix | Heading |
|--------|---------|
| feat: | Features |
| fix: | Bug Fixes |
| refactor: | Refactoring |
| chore: | Chores |
| docs: | Documentation |
| style: | Styles |
| perf: | Performance |
| test: | Tests |
| ci: | CI/CD |
| build: | Build |

Commits without a recognized prefix go under **Other**.

Build a changelog section in this format:

```
## v{version} — {YYYY-MM-DD}

### Features
- commit message (short sha)

### Bug Fixes
- commit message (short sha)

...
```

Only include category headings that have commits. Strip the prefix from the commit message in the list.

### 8. Update CHANGELOG.md

If `~/eulard/CHANGELOG.md` does not exist, create it with this header:

```
# Changelog

All notable changes to eulard are documented in this file.

```

Prepend the new version section immediately after the header line (after the blank line following the description). Existing entries stay below.

### 9. Update package.json Version

```bash
cd ~/eulard && npm version {version} --no-git-tag-version
```

This updates the `version` field in package.json (and package-lock.json if present) without creating a git tag.

### 10. Commit

```bash
cd ~/eulard && git add CHANGELOG.md package.json package-lock.json 2>/dev/null; git add CHANGELOG.md package.json
cd ~/eulard && git commit -m "release: v{version}"
```

### 11. Tag

```bash
cd ~/eulard && git tag v{version}
```

### 12. Push

```bash
cd ~/eulard && git push origin main --follow-tags
```

### 13. Create PR to Stable

Use the changelog section generated in step 7 as the PR body.

```bash
cd ~/eulard && gh pr create --base stable --head main \
  --title "Release v{version}" \
  --body "$(cat <<'EOF'
{changelog section from step 7}

---
Merging this PR will auto-deploy to production.
EOF
)"
```

### 14. Report

```
## Release v{version}

**PR**: https://github.com/kelihi/eulard/pull/<number>
**Tag**: v{version}
**Bump**: {old_version} -> {version} ({bump_type})

### Changelog
{changelog section}

**Next step**: Merge the PR to `stable` to auto-deploy to production (https://eulard.kelihi.com).
```

## Error Handling

- If `git push` fails, suggest `git pull --rebase origin main` and retry
- If `gh pr create` fails because a PR already exists from main to stable, find it and show its URL
- If there are no commits since the last tag, abort with a clear message — nothing to release
