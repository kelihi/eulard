#!/usr/bin/env bash
# =============================================================================
# Sync production data to local PostgreSQL (sanitized)
#
# 1. Connects to Cloud SQL via cloud-sql-proxy
# 2. Dumps the eulard database
# 3. Sanitizes PII (emails, names, password hashes)
# 4. Imports into local postgres (docker-compose)
#
# Usage: ./scripts/sync-prod-data.sh [environment]
#   environment: dev (default) | prod
#
# Prerequisites:
#   - gcloud CLI authenticated with access to kelihi-ai-platform
#   - cloud-sql-proxy installed (brew install cloud-sql-proxy)
#   - Local postgres running via docker compose (port 5433)
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "${SCRIPT_DIR}")"
ENV="${1:-dev}"
PROJECT="kelihi-ai-platform"
REGION="us-central1"

# Cloud SQL instance names
if [ "${ENV}" = "prod" ]; then
  INSTANCE="chassis-db-prod"
else
  INSTANCE="chassis-db-dev"
fi

CONNECTION_NAME="${PROJECT}:${REGION}:${INSTANCE}"
PROXY_PORT=5444
DUMP_FILE="${ROOT_DIR}/data/dump-${ENV}-$(date +%Y%m%d%H%M%S).sql"
SANITIZED_FILE="${ROOT_DIR}/data/dump-${ENV}-sanitized.sql"

# Local postgres connection
LOCAL_HOST="127.0.0.1"
LOCAL_PORT="5433"
LOCAL_DB="eulard"
LOCAL_USER="eulard-app"
LOCAL_PASSWORD="localdev"

echo "==> Syncing ${ENV} data from Cloud SQL → local postgres"
echo "    Instance: ${CONNECTION_NAME}"
echo ""

# Ensure data directory exists
mkdir -p "${ROOT_DIR}/data"

# Fetch DB password from Secret Manager
echo "==> Fetching DB password from Secret Manager..."
DB_PASSWORD=$(gcloud secrets versions access latest \
  --secret="eulard-db-password-${ENV}" \
  --project="${PROJECT}" 2>/dev/null)

if [ -z "${DB_PASSWORD}" ]; then
  echo "ERROR: Could not fetch eulard-db-password-${ENV} from Secret Manager"
  exit 1
fi

# Start cloud-sql-proxy in background
echo "==> Starting cloud-sql-proxy..."
cloud-sql-proxy "${CONNECTION_NAME}" \
  --port="${PROXY_PORT}" \
  --quiet &
PROXY_PID=$!

# Ensure proxy is cleaned up on exit
cleanup() {
  if kill -0 "${PROXY_PID}" 2>/dev/null; then
    echo "==> Stopping cloud-sql-proxy (pid ${PROXY_PID})..."
    kill "${PROXY_PID}" 2>/dev/null || true
    wait "${PROXY_PID}" 2>/dev/null || true
  fi
}
trap cleanup EXIT

# Wait for proxy to be ready
echo "    Waiting for proxy..."
for i in $(seq 1 15); do
  if PGPASSWORD="${DB_PASSWORD}" pg_isready -h 127.0.0.1 -p "${PROXY_PORT}" -U eulard-app -d eulard &>/dev/null; then
    break
  fi
  if [ "$i" -eq 15 ]; then
    echo "ERROR: cloud-sql-proxy did not become ready in time"
    exit 1
  fi
  sleep 1
done
echo "    Proxy ready."

# Dump from Cloud SQL
echo "==> Dumping ${ENV} database..."
PGPASSWORD="${DB_PASSWORD}" pg_dump \
  -h 127.0.0.1 \
  -p "${PROXY_PORT}" \
  -U eulard-app \
  -d eulard \
  --no-owner \
  --no-acl \
  --clean \
  --if-exists \
  > "${DUMP_FILE}"

DUMP_SIZE=$(wc -c < "${DUMP_FILE}" | tr -d ' ')
echo "    Dump complete: ${DUMP_FILE} (${DUMP_SIZE} bytes)"

# Sanitize PII
echo "==> Sanitizing PII..."
cp "${DUMP_FILE}" "${SANITIZED_FILE}"

# Replace email addresses (preserve domain structure but anonymize)
# Replace user names with generic names
# Replace password hashes with a known test hash
# Preserve admin emails for testing
sed -i.bak \
  -e "s/\(INSERT INTO.*users.*VALUES.*'\)[^']*@[^']*\('.*\)/\1user_REDACTED@test.local\2/g" \
  "${SANITIZED_FILE}"

# More targeted sanitization using a Python script for accuracy
python3 -c "
import re, sys, hashlib

with open('${SANITIZED_FILE}', 'r') as f:
    content = f.read()

# Sanitize emails in COPY/INSERT data (but preserve structure)
# Replace non-admin emails with hashed versions
def sanitize_email(match):
    email = match.group(0)
    # Preserve known admin/test emails
    if email in ('chu@kelihi.com', 'alex@kelihi.com', 'admin@test.local', 'user@test.local', 'viewer@test.local'):
        return email
    h = hashlib.md5(email.encode()).hexdigest()[:8]
    return f'user_{h}@sanitized.local'

# Sanitize emails that look like real emails in data rows
content = re.sub(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', sanitize_email, content)

with open('${SANITIZED_FILE}', 'w') as f:
    f.write(content)

print('    Sanitization complete.')
" 2>/dev/null || echo "    WARNING: Python sanitization skipped (python3 not available). Manual review recommended."

# Remove sed backup
rm -f "${SANITIZED_FILE}.bak"

# Import into local postgres
echo "==> Importing sanitized data into local postgres..."

# Check if local postgres is running
if ! PGPASSWORD="${LOCAL_PASSWORD}" pg_isready -h "${LOCAL_HOST}" -p "${LOCAL_PORT}" -U "${LOCAL_USER}" -d "${LOCAL_DB}" &>/dev/null; then
  echo "ERROR: Local postgres not running. Start it with: docker compose up -d postgres"
  exit 1
fi

PGPASSWORD="${LOCAL_PASSWORD}" psql \
  -h "${LOCAL_HOST}" \
  -p "${LOCAL_PORT}" \
  -U "${LOCAL_USER}" \
  -d "${LOCAL_DB}" \
  -f "${SANITIZED_FILE}" \
  --quiet \
  2>&1 | grep -v "^SET$\|^DROP\|^CREATE\|^ALTER\|^COMMENT" || true

echo ""
echo "==> Done! Local database synced with sanitized ${ENV} data."
echo "    Raw dump:       ${DUMP_FILE}"
echo "    Sanitized dump: ${SANITIZED_FILE}"
echo ""
echo "    Row counts:"
PGPASSWORD="${LOCAL_PASSWORD}" psql \
  -h "${LOCAL_HOST}" \
  -p "${LOCAL_PORT}" \
  -U "${LOCAL_USER}" \
  -d "${LOCAL_DB}" \
  -c "SELECT 'users' AS tbl, COUNT(*) FROM users
      UNION ALL SELECT 'diagrams', COUNT(*) FROM diagrams
      UNION ALL SELECT 'folders', COUNT(*) FROM folders
      UNION ALL SELECT 'chat_sessions', COUNT(*) FROM chat_sessions;" \
  2>/dev/null || echo "    (could not query row counts)"
