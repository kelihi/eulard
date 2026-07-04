# Skill: Deploy to Staging

Deploy Eulard to the staging Cloud Run service (`eulard-staging`).

## When to use
- When asked to "deploy to staging" or "deploy to dev"
- As part of the `/iterate` or `/deploy` flow
- When manually deploying after code changes

## Quick deploy (image already built)

```bash
gcloud run services update eulard-staging \
  --image=us-central1-docker.pkg.dev/kelihi-ai-platform/eulard/eulard:latest \
  --region=us-central1 \
  --project=kelihi-ai-platform
```

## Full deploy (build + deploy)

```bash
cd ~/eulard
SHA=$(git rev-parse --short HEAD)
gcloud builds submit \
  --config=cloudbuild-staging.yaml \
  --substitutions="_TAG=staging-${SHA}" \
  --project=kelihi-ai-platform \
  .
```

This uses `cloudbuild-staging.yaml` which builds the Docker image and updates the `eulard-staging` Cloud Run service.

## Verify deployment

```bash
# Health check
URL=$(gcloud run services describe eulard-staging \
  --project=kelihi-ai-platform --region=us-central1 \
  --format="value(status.url)")
curl -sf "${URL}/api/healthz"

# Or via custom domain
curl -sf https://staging.eulard.kelihi.com/api/healthz

# Check current revision
gcloud run services describe eulard-staging \
  --project=kelihi-ai-platform --region=us-central1 \
  --format="table(status.traffic.revisionName, status.traffic.percent)"

# Recent logs
gcloud run services logs read eulard-staging \
  --project=kelihi-ai-platform \
  --region=us-central1 \
  --limit=20
```

## Script deploy

```bash
./scripts/deploy-staging.sh                  # Full build + deploy
./scripts/deploy-staging.sh --deploy-only    # Redeploy latest image
./scripts/deploy-staging.sh --image TAG      # Deploy a specific tag
```

## Key details

| Setting | Value |
|---|---|
| Service | `eulard-staging` |
| URL | https://staging.eulard.kelihi.com |
| Cloud Run URL | https://eulard-staging-na7526ntjq-uc.a.run.app |
| GCP Project | `kelihi-ai-platform` |
| Region | `us-central1` |
| Cloud SQL | `chassis-db-dev` |
| Branch | `main` (auto-deploys via GitHub Actions) |
