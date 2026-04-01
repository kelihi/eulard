# Skill: Deploy to Dev

Build and deploy the current branch to the Eulard dev Cloud Run instance.

## When to use
- When the user asks to deploy to dev, staging, or test
- When the user says "ship it" or "deploy" without specifying prod
- After completing a feature that needs live testing

## Steps

### 1. Pre-flight checks

Run a local build to catch errors before submitting to Cloud Build:

```bash
pnpm lint && pnpm exec tsc --noEmit && pnpm build
```

If any step fails, fix the issue before proceeding. Do not deploy broken code.

### 2. Submit to Cloud Build

Build the container image and deploy to Cloud Run dev in one step:

```bash
SHORT_SHA=$(git rev-parse --short HEAD)
gcloud builds submit \
  --config=cloudbuild-dev.yaml \
  --substitutions="_TAG=dev-${SHORT_SHA}" \
  --project=kelihi-ai-platform \
  .
```

This uses `cloudbuild-dev.yaml` which builds the Docker image and updates the `eulard-dev` Cloud Run service.

### 3. Verify deployment

Check that the new revision is serving and healthy:

```bash
# Get the service URL
URL=$(gcloud run services describe eulard-dev \
  --project=kelihi-ai-platform \
  --region=us-central1 \
  --format="value(status.url)")

# Health check
curl -sf "${URL}/api/healthz" && echo "Health check passed" || echo "Health check FAILED"

# Show the active revision
gcloud run services describe eulard-dev \
  --project=kelihi-ai-platform \
  --region=us-central1 \
  --format="value(status.traffic.revisionName)"
```

### 4. If deployment fails

Check recent logs for errors:

```bash
gcloud run services logs read eulard-dev \
  --project=kelihi-ai-platform \
  --region=us-central1 \
  --limit=30
```

Common issues:
- **Container fails to start**: Check `INSTANCE_CONNECTION_NAME` and secret bindings
- **Build fails**: Check Cloud Build logs: `gcloud builds list --project=kelihi-ai-platform --limit=5`
- **Health check fails**: The app may need secrets or DB access configured. Check env vars.

## Alternative: Script-based deploy

You can also use the deploy script directly:

```bash
./scripts/deploy-dev.sh                  # Full build + deploy
./scripts/deploy-dev.sh --deploy-only    # Redeploy latest image
./scripts/deploy-dev.sh --image TAG      # Deploy a specific tag
```

## Key details

| Setting | Value |
|---|---|
| GCP Project | `kelihi-ai-platform` |
| Region | `us-central1` |
| Service | `eulard-dev` |
| Image registry | `us-central1-docker.pkg.dev/kelihi-ai-platform/eulard/eulard` |
| Cloud SQL | `chassis-db-dev` |
| Service account | `eulard-sa@kelihi-ai-platform.iam.gserviceaccount.com` |
| App port | 3000 |
