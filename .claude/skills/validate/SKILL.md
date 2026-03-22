---
name: validate
description: "Run all local checks (lint, type check, build) — replaces CI pipeline."
---

Local replacement for the GitHub Actions PR Check workflow. Runs all validation locally.

## Steps

### 1. Install Dependencies

```bash
cd ~/eulard && pnpm install --frozen-lockfile
```

### 2. Lint

```bash
cd ~/eulard && pnpm lint
```

### 3. Type Check

```bash
cd ~/eulard && pnpm exec tsc --noEmit
```

### 4. Build

```bash
cd ~/eulard && pnpm build
```

### 5. Report

Summarize all results with pass/fail status and error details.
