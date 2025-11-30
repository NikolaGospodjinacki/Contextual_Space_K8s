#!/bin/bash
# Create local k3d cluster for Contextual Space previews
# Usage: ./create-cluster.sh [CLUSTER_NAME]

set -e

CLUSTER_NAME="${1:-pr-previews}"

echo "🔍 Checking for existing cluster '$CLUSTER_NAME'..."

if k3d cluster list | grep -q "$CLUSTER_NAME"; then
    echo "⚠️  Cluster '$CLUSTER_NAME' already exists"
    read -p "Delete and recreate? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🗑️  Deleting existing cluster..."
        k3d cluster delete "$CLUSTER_NAME"
    else
        echo "Using existing cluster"
        exit 0
    fi
fi

echo ""
echo "🚀 Creating k3d cluster '$CLUSTER_NAME'..."

# Create cluster with:
# - Traefik disabled (we use Nginx Ingress)
# - Port 8080 mapped to ingress (Windows blocks port 80)
# - Port 8443 for HTTPS
k3d cluster create "$CLUSTER_NAME" \
    --api-port 6550 \
    --port "8080:80@loadbalancer" \
    --port "8443:443@loadbalancer" \
    --k3s-arg "--disable=traefik@server:0" \
    --wait

echo ""
echo "⏳ Waiting for cluster to be ready..."
kubectl wait --for=condition=ready node --all --timeout=120s

echo ""
echo "📦 Installing Nginx Ingress Controller..."
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.9.4/deploy/static/provider/cloud/deploy.yaml

echo ""
echo "⏳ Waiting for Nginx Ingress to be ready..."
kubectl wait --namespace ingress-nginx \
    --for=condition=ready pod \
    --selector=app.kubernetes.io/component=controller \
    --timeout=120s

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║   ✅ Cluster '$CLUSTER_NAME' is ready!                     ║"
echo "╠════════════════════════════════════════════════════════════╣"
echo "║                                                            ║"
echo "║   Access previews at: http://localhost:8080/pr-{N}/        ║"
echo "║                                                            ║"
echo "║   Deploy a preview:                                        ║"
echo "║     ./scripts/local/deploy-preview.sh 1                    ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
