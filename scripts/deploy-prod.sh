#!/usr/bin/env bash
# =============================================================================
# Eulard — Deploy to Cloud Run (prod)
# Usage: ./scripts/deploy-prod.sh [--build-only | --deploy-only | --image TAG]
#
# This deploys eulard to the production Cloud Run service.
#
# Modes:
#   (default)       Build image via Cloud Build, then deploy to Cloud Run
#   --build-only    Build and push image only, skip deployment
#   --deploy-only   Deploy using the latest image (skip build)
#   --image TAG     Deploy a specific image tag (e.g., prod-abc1234)
#
# Prerequisites:
#   - gcloud CLI authenticated with access to kelihi-ai-platform
#   - Secrets populated in Secret Manager (scripts/populate-secrets.sh)
#   - Cloud SQL instance chassis-db-prod exists with eulard database
#   - Cloud Run service eulard-prod created (this script will create it on first run)
# =============================================================================
set -euo pipefail

PROJECT="kelihi-ai-platform"
REGION="us-central1"
SERVICE="eulard-prod"
IMAGE_BASE="us-central1-docker.pkg.dev/${PROJECT}/eulard/eulard"
# TODO: Update to chassis-db-prod once the prod Cloud SQL instance is provisioned.
# For now, this points to the dev database.
CLOUDSQL_CONNECTION="kelihi-ai-platform:us-central1:chassis-db-prod"
SERVICE_ACCOUNT="eulard-sa@kelihi-ai-platform.iam.gserviceaccount.com"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "${SCRIPT_DIR}")"

# Parse flags
BUILD_ONLY=false
DEPLOY_ONLY=false
CUSTOM_TAG=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --build-only)  BUILD_ONLY=true; shift ;;
    --deploy-only) DEPLOY_ONLY=true; shift ;;
    --image)       CUSTOM_TAG="$2"; shift 2 ;;
    *) echo "Unknown flag: $1"; exit 1 ;;
  esac
done

echo "============================================"
echo "  Eulard Cloud Run PROD Deployment"
echo "============================================"

# ---- Resolve tag ----
if [ -n "${CUSTOM_TAG}" ]; then
  TAG="${CUSTOM_TAG}"
elif [ "${DEPLOY_ONLY}" = true ]; then
  TAG="latest"
else
  SHORT_SHA=$(git -C "${ROOT_DIR}" rev-parse --short HEAD 2>/dev/null || echo "local")
  TAG="prod-${SHORT_SHA}"
fi

# ---- Build ----
if [ "${DEPLOY_ONLY}" = false ] && [ -z "${CUSTOM_TAG}" ]; then
  echo ""
  echo "==> Building and pushing container image (tag: ${TAG})..."

  gcloud builds submit \
    --config="${ROOT_DIR}/cloudbuild.yaml" \
    --substitutions="SHORT_SHA=${TAG}" \
    --project="${PROJECT}" \
    "${ROOT_DIR}"

  echo "==> Image pushed: ${IMAGE_BASE}:${TAG}"
fi

if [ "${BUILD_ONLY}" = true ]; then
  echo "==> Build only mode — skipping deployment."
  exit 0
fi

# ---- Deploy ----
echo ""
echo "==> Deploying ${SERVICE} to Cloud Run (image: ${TAG})..."

# Check if the service already exists
if gcloud run services describe "${SERVICE}" \
    --project="${PROJECT}" --region="${REGION}" \
    --format="value(name)" &>/dev/null; then
  # Service exists — just update the image
  echo "    Service exists, updating image..."
  gcloud run services update "${SERVICE}" \
    --image="${IMAGE_BASE}:${TAG}" \
    --region="${REGION}" \
    --project="${PROJECT}"
else
  # First deploy — create the service with full configuration
  echo "    Creating new Cloud Run service..."
  gcloud run deploy "${SERVICE}" \
    --image="${IMAGE_BASE}:${TAG}" \
    --platform=managed \
    --region="${REGION}" \
    --project="${PROJECT}" \
    --service-account="${SERVICE_ACCOUNT}" \
    --allow-unauthenticated \
    --add-cloudsql-instances="${CLOUDSQL_CONNECTION}" \
    --vpc-connector=chassis-vpc-cx-prod \
    --vpc-egress=private-ranges-only \
    --port=3000 \
    --cpu=1 \
    --memory=1Gi \
    --min-instances=1 \
    --max-instances=5 \
    --concurrency=80 \
    --timeout=300 \
    --set-env-vars="NODE_ENV=production" \
    --set-env-vars="NEXT_TELEMETRY_DISABLED=1" \
    --set-env-vars="HOSTNAME=0.0.0.0" \
    --set-env-vars="INSTANCE_CONNECTION_NAME=kelihi-ai-platform:us-central1:chassis-db-prod" \
    --set-env-vars="DB_NAME=eulard" \
    --set-env-vars="DB_USER=eulard-app" \
    --set-env-vars="AUTH_GOOGLE_ALLOWED_DOMAINS=kelihi.com" \
    --set-env-vars="AUTH_TRUST_HOST=true" \
    --set-env-vars="NEXTAUTH_URL=https://eulard.kelihi.com" \
    --set-env-vars="AUTH_URL=https://eulard.kelihi.com" \
    --set-secrets="DB_PASSWORD=eulard-db-password-prod:latest" \
    --set-secrets="NEXTAUTH_SECRET=eulard-nextauth-secret-prod:latest" \
    --set-secrets="AUTH_GOOGLE_CLIENT_ID=eulard-google-oauth-client-id-prod:latest" \
    --set-secrets="AUTH_GOOGLE_CLIENT_SECRET=eulard-google-oauth-client-secret-prod:latest" \
    --set-secrets="ANTHROPIC_API_KEY=eulard-anthropic-api-key-prod:latest" \
    --labels="environment=prod,managed-by=script" \
    --quiet
fi

echo ""
echo "==> Deployment complete!"

# Show service URL
URL=$(gcloud run services describe "${SERVICE}" \
  --project="${PROJECT}" \
  --region="${REGION}" \
  --format="value(status.url)" 2>/dev/null || echo "<pending>")

echo "==> Service URL: ${URL}"
echo ""
echo "==> Post-deployment:"
echo "    1. Verify health: curl ${URL}/api/healthz"
echo "    2. Check logs:    gcloud run services logs read ${SERVICE} --project=${PROJECT} --region=${REGION} --limit=20"
