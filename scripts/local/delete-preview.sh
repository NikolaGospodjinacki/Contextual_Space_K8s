#!/bin/bash
# Delete a preview environment
# Usage: ./delete-preview.sh <PR_NUMBER>

set -e

if [ -z "$1" ]; then
    echo "❌ Usage: ./delete-preview.sh <PR_NUMBER>"
    exit 1
fi

PR_NUMBER=$1
NAMESPACE="pr-$PR_NUMBER"
PR_PATH="pr-$PR_NUMBER"

echo "🗑️  Deleting preview for PR #$PR_NUMBER..."

if kubectl get namespace "$NAMESPACE" &> /dev/null; then
    kubectl delete namespace "$NAMESPACE"
    echo "✅ Namespace $NAMESPACE deleted"
else
    echo "⚠️  Namespace $NAMESPACE does not exist"
fi

# Clean up Docker images
echo ""
echo "🧹 Cleaning up Docker images..."
docker rmi "contextual-space-frontend:$PR_PATH" 2>/dev/null || true
docker rmi "contextual-space-backend:$PR_PATH" 2>/dev/null || true

echo ""
echo "✅ Preview for PR #$PR_NUMBER cleaned up"
