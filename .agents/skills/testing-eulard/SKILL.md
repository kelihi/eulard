# Testing Eulard (VizMerm) Locally

## Overview
Eulard is a Next.js 15 + React 19 Mermaid diagram editor. The app requires PostgreSQL and next-auth for authentication.

## Devin Secrets Needed
No special secrets needed for local testing. The app seeds a default admin user automatically.

## Local Environment Setup

### 1. PostgreSQL
```bash
# Install and start PostgreSQL
sudo apt-get update && sudo apt-get install -y postgresql postgresql-contrib
sudo pg_ctlcluster 14 main start

# Create user and database (use any local-only test password)
sudo -u postgres createuser -s eulard_user
sudo -u postgres createdb eulard -O eulard_user
sudo -u postgres psql -c "ALTER USER eulard_user WITH PASSWORD '<local-test-password>';"
```

### 2. Install Dependencies
```bash
pnpm install
```

### 3. Start Dev Server
Set the following environment variables before running `pnpm dev`:
- `DB_HOST=127.0.0.1`
- `DB_PORT=5432`
- `DB_NAME=eulard`
- `DB_USER=eulard_user`
- `DB_PASSWORD=<local-test-password>` (match the password set in step 1)
- `AUTH_SECRET=<any-random-string>` (e.g. generate with `openssl rand -base64 32`)
- `NEXTAUTH_URL=http://localhost:3000`

Then run:
```bash
pnpm dev
```

**Note:** If port 3000 is already in use (e.g. from a previous session), Next.js will auto-select the next available port (e.g. 3001). Check the terminal output for the actual URL.

### 4. Seed the Database
The `/api/init` endpoint must be called before logging in. The middleware redirects unauthenticated users to `/login` before the homepage can call `/api/init`, so you need to call it manually first:
```bash
curl http://localhost:3000/api/init
```
(Adjust port if the dev server chose a different one.)

### 5. Login Credentials
The seed script creates a default admin user:
- Email: value of `ADMIN_EMAIL` env var (defaults to the repo owner's email)
- Password: value of `ADMIN_DEFAULT_PASSWORD` env var (defaults to `changeme123`)

## UI Navigation

### Editor Page
- After login, the app redirects to `/` which auto-creates a diagram and redirects to `/editor/[id]`
- The editor has a split view: **Code Editor** (left) and **Mermaid Preview** (right)
- Toggle between "Code + Preview" and "Visual Canvas" modes using the tab buttons at the top
- An AI Chat panel is on the far right side

### Mermaid Preview Controls
- The preview panel has a toolbar with zoom controls (zoom in/out, fit-to-view, reset zoom)
- When the mermaid code contains `subgraph` blocks, a "Sections" button appears in the toolbar
- Clicking "Sections" reveals a toggle panel to show/hide individual subgraph sections

### Testing Section Toggle Persistence
To verify that section visibility persists after code edits (a previously fixed bug):
1. Enter mermaid code with `subgraph` blocks
2. Open the Sections panel and hide a section
3. Edit the code (e.g. add a `%% comment` line) to trigger a re-render
4. Verify the hidden section stays hidden after the SVG re-renders (~300ms debounce)

### Code Editor
- The left panel is a CodeMirror editor
- Use Ctrl+A to select all code, then type to replace
- Changes auto-save after 1 second debounce
- Preview updates after 300ms debounce

## Build & Lint
```bash
npx next lint    # May prompt for ESLint config on first run - select "Strict"
npx next build   # Full production build with type checking
```

## Notes
- The app uses `pg` (PostgreSQL) for the database, not SQLite
- Authentication uses next-auth with credentials provider (JWT strategy)
- The middleware at `src/middleware.ts` protects most routes but `/api/init` is accessible without auth
- The `.eslintrc.json` file may be auto-generated on first lint run - don't commit it unless it was already in the repo
- `visual-canvas.tsx` is a separate React Flow component (Phase 2) - don't modify it when working on the preview
- No CI is configured on this repo - rely on local `npx next lint` and `npx next build` checks
