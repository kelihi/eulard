# Testing Eulard Diagram Editor

## Overview
Eulard is a Next.js 15 app with React Flow visual canvas, Mermaid preview, PostgreSQL (Cloud SQL), and NextAuth credentials + Google OAuth.

## Devin Secrets Needed
- `DEVIN_GCP_SERVICE_ACCOUNT_JSON` — GCP service account with Cloud SQL Admin access

## Local Dev Server Setup

### 1. Start Cloud SQL Auth Proxy
The app's `.envrc` sets `INSTANCE_CONNECTION_NAME` which makes the app try to connect via Cloud SQL Unix socket (only works on Cloud Run). Locally, you need the Cloud SQL Auth Proxy for TCP connections.

```bash
# Download proxy if not present
curl -o /tmp/cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.14.3/cloud-sql-proxy.linux.amd64
chmod +x /tmp/cloud-sql-proxy

# Write service account key
echo "$DEVIN_GCP_SERVICE_ACCOUNT_JSON" > /tmp/sa-key.json

# Start proxy on port 15432 (background)
/tmp/cloud-sql-proxy --credentials-file=/tmp/sa-key.json --port=15432 "${GCP_SQL_CONNECTION_NAME}"
```

### 2. Create a Test DB User
The `eulard_user` password in `.env` may not work for TCP connections (the app on Cloud Run uses Unix socket auth via the proxy). Create a dedicated test user:

```bash
export PATH="/home/ubuntu/repos/feedback_system/google-cloud-sdk/bin:$PATH"
gcloud auth activate-service-account --key-file=/tmp/sa-key.json
gcloud sql users create devin-test-user --instance=kelihi-infra-db2 --project=theta-totem-433300-v7 --password=devin-test-pw-2026
```

Then grant access to eulard tables:
```bash
PGPASSWORD='devin-test-pw-2026' psql -h 127.0.0.1 -p 15432 -U devin-test-user -d eulard -c "GRANT eulard_user TO \"devin-test-user\";"
```

If the user already exists, just connect directly.

### 3. Seed a Test App User
Generate a bcrypt hash and insert a user:
```bash
# Generate bcrypt hash for password123
cd ~/repos/eulard && node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('password123', 12));"

# Insert test user (use SET ROLE to access eulard_user's tables)
PGPASSWORD='devin-test-pw-2026' psql -h 127.0.0.1 -p 15432 -U devin-test-user -d eulard -c "
SET ROLE eulard_user;
INSERT INTO users (id, email, name, password_hash, role, created_at, updated_at)
VALUES ('devin-local-test-001', 'devin-test@test.local', 'Devin Tester', '<bcrypt_hash>', 'admin', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash;
"
```

### 4. Start Dev Server with Proxy DB
IMPORTANT: The `.envrc` exports DB vars that override `.env.local`. You must explicitly set DB env vars AFTER sourcing `.envrc`, or start without sourcing it:

```bash
export DB_HOST=127.0.0.1 && export DB_PORT=15432 && export DB_USER=devin-test-user && export DB_PASSWORD=devin-test-pw-2026 && export DB_SSL=false && export DB_NAME=eulard && unset INSTANCE_CONNECTION_NAME && export NEXTAUTH_URL=http://localhost:3000 && export NEXTAUTH_SECRET=local-dev-secret-change-me-in-production && export AUTH_TRUST_HOST=true && pnpm dev
```

Verify DB connection: `curl -s http://localhost:3000/api/init` should return `{"ok":true,"initialized":true}`

## Login Flow
1. Navigate to http://localhost:3000 (redirects to /login)
2. Click "Sign in with email instead" to reveal email/password form
3. Enter test credentials: `devin-test@test.local` / `password123`
4. Click "Sign in" — redirects to editor dashboard

## Testing Diagram Features
- **New Diagram**: Click "+" button in sidebar header
- **Split View**: "Code + Preview" tab shows code editor + Mermaid preview side by side
- **Canvas View**: "Visual Canvas" tab shows interactive React Flow canvas
- **Subgraph test code**: Use `graph TD` with `subgraph Name["Label"]...end` blocks
- **Auto-save**: Diagrams auto-save; check status indicator next to title ("Saved")

## Common Issues
- **DB password auth failure**: The password in `.env` works via Unix socket on Cloud Run but may fail for TCP. Use the Cloud SQL proxy + dedicated test user approach above.
- **INSTANCE_CONNECTION_NAME override**: `.envrc` sets this as a shell env var which takes precedence over `.env.local`. Must explicitly `unset INSTANCE_CONNECTION_NAME` before starting dev server.
- **direnv auto-loading**: When entering the repo directory, direnv automatically loads `.envrc` and may override your manually-set env vars. Set DB vars in the same command chain as `pnpm dev`.
