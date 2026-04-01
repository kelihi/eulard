# Eulard — Claude Code Project Config

## Git Workflow

**Staging (autonomous/yolo mode):** Commit and push directly to `main`. GitHub Actions auto-deploys to staging. No PR needed. Use `/iterate` for the full loop (typecheck → commit → push → deploy).

**Prod (requires approval):** Use `/release [major|minor|patch]` to cut a versioned release. This creates a PR from `main` → `stable` which requires 1 approval before merge. Merging auto-deploys to prod.

### Branch rules
- `main`: Direct push allowed. PRs require CI to pass.
- `stable`: PRs required (no direct push). Requires 1 approval + CI pass. Stale approvals dismissed on new pushes.

## Environments

| Env | URL | Branch | Deploy |
|-----|-----|--------|--------|
| Local | http://localhost:3000 | feature branches | `./scripts/local-up.sh` |
| Staging | https://staging.eulard.kelihi.com | `main` | Auto on push |
| Prod | https://eulard.kelihi.com | `stable` | Auto on PR merge |

## Stack
- Next.js 15 (App Router, Turbopack)
- React Flow (visual canvas), Mermaid (diagram syntax)
- Zustand (state), NextAuth v5 (auth), PostgreSQL (Cloud SQL)
- Claude AI (diagram editing via tool calls)
- Cloud Run (staging + prod), GitHub Actions CI/CD

## Key commands
- `/iterate` — fast dev loop: typecheck → commit → push → deploy staging
- `/validate` — run lint + typecheck + build locally
- `/release` — cut versioned release with changelog + PR to stable
- `/ship` — create PR to main with auto-merge
- `/deploy` — full validation + deploy to staging
