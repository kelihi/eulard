# Skill: Deployment Status

Check the current deployment status of Eulard Cloud Run services (staging and prod).

## When to use
- When the user asks "is it deployed?" or "what's running?"
- When the user wants to check service health
- When debugging deployment issues
- When the user asks about logs or errors

## Steps

### 1. Check service status for both environments

```bash
echo "=== STAGING (eulard-staging) ==="
gcloud run services describe eulard-staging \
  --project=kelihi-ai-platform \
  --region=us-central1 \
  --format="table(status.url, status.traffic.revisionName, status.traffic.percent, metadata.annotations['client.knative.dev/user-image'])" \
  2>/dev/null || echo "Service not found"

echo ""
echo "=== PROD (eulard-prod) ==="
gcloud run services describe eulard-prod \
  --project=kelihi-ai-platform \
  --region=us-central1 \
  --format="table(status.url, status.traffic.revisionName, status.traffic.percent, metadata.annotations['client.knative.dev/user-image'])" \
  2>/dev/null || echo "Service not found"
```

### 2. Health checks

```bash
# Staging health
STAGING_URL=$(gcloud run services describe eulard-staging \
  --project=kelihi-ai-platform --region=us-central1 \
  --format="value(status.url)" 2>/dev/null)
if [ -n "$STAGING_URL" ]; then
  echo "Staging health: $(curl -sf -o /dev/null -w '%{http_code}' "${STAGING_URL}/api/healthz" || echo 'unreachable')"
fi

# Prod health
PROD_URL=$(gcloud run services describe eulard-prod \
  --project=kelihi-ai-platform --region=us-central1 \
  --format="value(status.url)" 2>/dev/null)
if [ -n "$PROD_URL" ]; then
  echo "Prod health: $(curl -sf -o /dev/null -w '%{http_code}' "${PROD_URL}/api/healthz" || echo 'unreachable')"
fi
```

### 3. Recent logs (if needed)

```bash
# Staging logs
gcloud run services logs read eulard-staging \
  --project=kelihi-ai-platform \
  --region=us-central1 \
  --limit=20

# Prod logs
gcloud run services logs read eulard-prod \
  --project=kelihi-ai-platform \
  --region=us-central1 \
  --limit=20
```

### 4. Recent Cloud Build history

```bash
gcloud builds list \
  --project=kelihi-ai-platform \
  --limit=5 \
  --format="table(id, status, createTime, source.storageSource.object)"
```

### 5. List revisions (check rollback targets)

```bash
# Staging revisions
gcloud run revisions list \
  --service=eulard-staging \
  --project=kelihi-ai-platform \
  --region=us-central1 \
  --limit=5

# Prod revisions
gcloud run revisions list \
  --service=eulard-prod \
  --project=kelihi-ai-platform \
  --region=us-central1 \
  --limit=5
```

## Key details

| Setting | Staging | Prod |
|---|---|---|
| Service name | `eulard-staging` | `eulard-prod` |
| GCP Project | `kelihi-ai-platform` | `kelihi-ai-platform` |
| Region | `us-central1` | `us-central1` |
| Cloud SQL | `chassis-db-dev` | `chassis-db-prod` |
| Min instances | 0 | 1 |
| Max instances | 2 | 5 |

## Quick rollback

If a deployment is broken, roll back to the previous revision:

```bash
# List revisions to find the previous one
gcloud run revisions list --service=eulard-staging --project=kelihi-ai-platform --region=us-central1 --limit=3

# Roll back by routing traffic to the previous revision
gcloud run services update-traffic eulard-staging \
  --to-revisions=REVISION_NAME=100 \
  --project=kelihi-ai-platform \
  --region=us-central1
```
