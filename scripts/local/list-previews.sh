#!/bin/bash
# List all preview environments
# Usage: ./list-previews.sh

echo ""
echo "📋 Active Preview Environments"
echo "══════════════════════════════════════════════════════════════"
echo ""

# Get all PR namespaces
NAMESPACES=$(kubectl get namespaces -o name 2>/dev/null | grep "namespace/pr-" | sed 's/namespace\///')

if [ -z "$NAMESPACES" ]; then
    echo "No preview environments found."
    exit 0
fi

for NS in $NAMESPACES; do
    PR_NUM=$(echo "$NS" | sed 's/pr-//')
    echo "🔹 PR #$PR_NUM"
    echo "   URL: http://localhost:8080/$NS/"
    echo "   Pods:"
    kubectl get pods -n "$NS" --no-headers 2>/dev/null | while read line; do
        echo "      $line"
    done
    echo ""
done
