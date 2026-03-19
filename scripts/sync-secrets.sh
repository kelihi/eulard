#!/usr/bin/env bash
# =============================================================================
# Sync secrets from GCP Secret Manager → Kubernetes Secret
# Usage: ./scripts/sync-secrets.sh [environment]
# =============================================================================
set -euo pipefail

ENV="${1:-dev}"
PROJECT="kelihi-ai-platform"
NAMESPACE="eulard"
SECRET_NAME="eulard-secrets"

echo "==> Syncing secrets for eulard (${ENV}) → K8s secret ${SECRET_NAME}"

# Fetch secrets from GCP Secret Manager
fetch_secret() {
  local name="$1"
  gcloud secrets versions access latest --secret="${name}-${ENV}" \
    --project="${PROJECT}" 2>/dev/null || echo ""
}

NEXTAUTH_SECRET=$(fetch_secret "eulard-nextauth-secret")
DB_PASSWORD=$(fetch_secret "eulard-db-password")
GOOGLE_CLIENT_ID=$(fetch_secret "eulard-google-oauth-client-id")
GOOGLE_CLIENT_SECRET=$(fetch_secret "eulard-google-oauth-client-secret")
ANTHROPIC_API_KEY=$(fetch_secret "eulard-anthropic-api-key")

# Get Cloud SQL private IP from Terraform output or use known value
DB_HOST=$(cd "$(dirname "$0")/../terraform" && tofu output -raw database_private_ip 2>/dev/null || echo "10.248.0.3")

# Validate required secrets
MISSING=()
[ -z "${NEXTAUTH_SECRET}" ] && MISSING+=("eulard-nextauth-secret")
[ -z "${DB_PASSWORD}" ] && MISSING+=("eulard-db-password")
[ -z "${ANTHROPIC_API_KEY}" ] && MISSING+=("eulard-anthropic-api-key")

if [ ${#MISSING[@]} -gt 0 ]; then
  echo "WARNING: Missing secrets: ${MISSING[*]}"
  echo "         Run populate-secrets.sh first or add them manually."
fi

# Delete existing secret if present
kubectl delete secret "${SECRET_NAME}" -n "${NAMESPACE}" --ignore-not-found

# Create K8s secret
kubectl create secret generic "${SECRET_NAME}" -n "${NAMESPACE}" \
  --from-literal=NEXTAUTH_SECRET="${NEXTAUTH_SECRET}" \
  --from-literal=NEXTAUTH_URL="https://eulard.kelihi.com" \
  --from-literal=DB_HOST="${DB_HOST}" \
  --from-literal=DB_PORT="5432" \
  --from-literal=DB_NAME="eulard" \
  --from-literal=DB_USER="eulard-app" \
  --from-literal=DB_PASSWORD="${DB_PASSWORD}" \
  --from-literal=DB_SSL="true" \
  --from-literal=AUTH_GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID}" \
  --from-literal=AUTH_GOOGLE_CLIENT_SECRET="${GOOGLE_CLIENT_SECRET}" \
  --from-literal=AUTH_GOOGLE_ALLOWED_DOMAINS="kelihi.com" \
  --from-literal=ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY}" \
  --from-literal=AUTH_TRUST_HOST="true"

echo "==> Done. Secret ${SECRET_NAME} created in namespace ${NAMESPACE}."
