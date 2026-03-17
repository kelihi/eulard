#!/usr/bin/env bash
# =============================================================================
# Eulard — Deploy to Cloud Run (dev)
# Usage: ./scripts/deploy-dev.sh [--build-only | --deploy-only | --image TAG]
#
# This deploys eulard to a Cloud Run service for dev/testing.
# Production remains on GKE (deployed via scripts/deploy.sh).
#
# Modes:
#   (default)       Build image via Cloud Build, then deploy to Cloud Run
#   --build-only    Build and push image only, skip deployment
#   --deploy-only   Deploy using the latest image (skip build)
#   --image TAG     Deploy a specific image tag (e.g., dev-abc1234)
#
# First-time setup:
#   1. Run: tofu apply -var-file="environments/dev.tfvars" (creates the service)
#   2. Or run this script (it will create the service if it doesn't exist)
#
# Prerequisites:
#   - gcloud CLI authenticated with access to kelihi-ai-platform
#   - Secrets populated in Secret Manager (scripts/populate-secrets.sh)
#   - Cloud SQL instance chassis-db-dev exists with eulard database
# =============================================================================
set -euo pipefail

PROJECT="kelihi-ai-platform"
REGION="us-central1"
SERVICE="eulard-dev"
IMAGE_BASE="us-central1-docker.pkg.dev/${PROJECT}/eulard/eulard"
CLOUDSQL_CONNECTION="kelihi-ai-platform:us-central1:chassis-db-dev"
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
echo "  Eulard Cloud Run Dev Deployment"
echo "============================================"

# ---- Resolve tag ----
if [ -n "${CUSTOM_TAG}" ]; then
  TAG="${CUSTOM_TAG}"
elif [ "${DEPLOY_ONLY}" = true ]; then
  TAG="latest"
else
  SHORT_SHA=$(git -C "${ROOT_DIR}" rev-parse --short HEAD 2>/dev/null || echo "local")
  TAG="dev-${SHORT_SHA}"
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
    --vpc-connector=chassis-vpc-cx-dev \
    --vpc-egress=private-ranges-only \
    --port=3000 \
    --cpu=1 \
    --memory=512Mi \
    --min-instances=0 \
    --max-instances=2 \
    --concurrency=80 \
    --timeout=300 \
    --set-env-vars="NODE_ENV=production" \
    --set-env-vars="NEXT_TELEMETRY_DISABLED=1" \
    --set-env-vars="HOSTNAME=0.0.0.0" \
    --set-env-vars="INSTANCE_CONNECTION_NAME=kelihi-ai-platform:us-central1:chassis-db-dev" \
    --set-env-vars="DB_NAME=eulard" \
    --set-env-vars="DB_USER=eulard-app" \
    --set-env-vars="AUTH_GOOGLE_ALLOWED_DOMAINS=kelihi.com" \
    --set-env-vars="AUTH_TRUST_HOST=true" \
    --set-secrets="DB_PASSWORD=eulard-db-password-dev:latest" \
    --set-secrets="NEXTAUTH_SECRET=eulard-nextauth-secret-dev:latest" \
    --set-secrets="AUTH_GOOGLE_CLIENT_ID=eulard-google-oauth-client-id-dev:latest" \
    --set-secrets="AUTH_GOOGLE_CLIENT_SECRET=eulard-google-oauth-client-secret-dev:latest" \
    --set-secrets="ANTHROPIC_API_KEY=eulard-anthropic-api-key-dev:latest" \
    --labels="environment=dev,managed-by=script" \
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
