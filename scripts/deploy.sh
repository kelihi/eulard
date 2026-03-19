#!/usr/bin/env bash
# =============================================================================
# Eulard — Full deployment to GKE
# Usage: ./scripts/deploy.sh [environment]
# =============================================================================
set -euo pipefail

ENV="${1:-dev}"
PROJECT="kelihi-ai-platform"
REGION="us-central1"
CLUSTER="chassis-gke-${ENV}"
NAMESPACE="eulard"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "${SCRIPT_DIR}")"

echo "============================================"
echo "  Eulard Deployment — ${ENV}"
echo "============================================"

# 1. Terraform
echo ""
echo "==> Step 1: Terraform infrastructure"
cd "${ROOT_DIR}/terraform"
tofu init \
  -backend-config="bucket=eulard-tfstate-${PROJECT}" \
  -backend-config="prefix=eulard/${ENV}"
tofu apply -var-file="environments/${ENV}.tfvars" -auto-approve

# 2. Connect to GKE
echo ""
echo "==> Step 2: Connect to GKE cluster"
gcloud container clusters get-credentials "${CLUSTER}" \
  --region="${REGION}" --project="${PROJECT}"

# 3. Apply K8s base resources
echo ""
echo "==> Step 3: Apply K8s base resources"
kubectl apply -f "${ROOT_DIR}/k8s/namespace.yaml"
kubectl apply -f "${ROOT_DIR}/k8s/service-account.yaml"
kubectl apply -f "${ROOT_DIR}/k8s/network-policy.yaml"

# 4. Populate & sync secrets
echo ""
echo "==> Step 4: Secrets"
"${SCRIPT_DIR}/populate-secrets.sh" "${ENV}"
"${SCRIPT_DIR}/sync-secrets.sh" "${ENV}"

# 5. Build and push image
echo ""
echo "==> Step 5: Build and push container image"
cd "${ROOT_DIR}"
gcloud builds submit --config=cloudbuild.yaml --project="${PROJECT}" .

# 6. Deploy app + ingress
echo ""
echo "==> Step 6: Deploy app and ingress"
kubectl apply -f "${ROOT_DIR}/k8s/"
kubectl apply -f "${ROOT_DIR}/k8s/hpa.yaml"
kubectl apply -f "${ROOT_DIR}/k8s/pdb.yaml"

# 7. Show status
echo ""
echo "==> Deployment complete. Status:"
kubectl get pods -n "${NAMESPACE}"
kubectl get svc -n "${NAMESPACE}"
kubectl get ingress -n "${NAMESPACE}"

echo ""
echo "==> Post-deployment:"
echo "    1. Create DNS A record: eulard → $(kubectl get ingress eulard-ingress -n ${NAMESPACE} -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo '<pending>')"
echo "    2. Monitor SSL cert: kubectl describe managedcertificate eulard-cert -n ${NAMESPACE}"
echo "    3. Verify: curl https://eulard.kelihi.com"
