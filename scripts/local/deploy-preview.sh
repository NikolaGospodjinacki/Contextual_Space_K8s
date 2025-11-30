#!/bin/bash
# Deploy a Contextual Space preview environment
# Usage: ./deploy-preview.sh <PR_NUMBER> [CLUSTER_NAME]

set -e

if [ -z "$1" ]; then
    echo "❌ Usage: ./deploy-preview.sh <PR_NUMBER> [CLUSTER_NAME]"
    echo "   Example: ./deploy-preview.sh 42"
    echo "   Example: ./deploy-preview.sh 42 pr-previews"
    exit 1
fi

PR_NUMBER=$1
CLUSTER_NAME="${2:-pr-previews}"
NAMESPACE="pr-$PR_NUMBER"
PR_PATH="pr-$PR_NUMBER"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║   🚀 Deploying Contextual Space Preview                    ║"
echo "╠════════════════════════════════════════════════════════════╣"
echo "║   PR Number:  #$PR_NUMBER"
echo "║   Namespace:  $NAMESPACE"
echo "║   Cluster:    $CLUSTER_NAME"
echo "║   URL:        http://localhost:8080/$PR_PATH/"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check if cluster exists
if ! k3d cluster list | grep -q "$CLUSTER_NAME"; then
    echo "❌ Cluster '$CLUSTER_NAME' not found!"
    echo "   Run ./create-cluster.sh first"
    exit 1
fi

# Build Docker images
echo "📦 Building Docker images..."
echo ""

echo "  → Building frontend with base path /$PR_PATH/..."
docker build \
    --build-arg VITE_BASE_PATH="/$PR_PATH/" \
    --build-arg VITE_SOCKET_URL="" \
    -t contextual-space-frontend:$PR_PATH \
    "$PROJECT_ROOT/apps/frontend"

echo ""
echo "  → Building backend..."
docker build \
    -t contextual-space-backend:$PR_PATH \
    "$PROJECT_ROOT/apps/backend"

# Import images to k3d
echo ""
echo "📤 Importing images to k3d cluster '$CLUSTER_NAME'..."
k3d image import \
    contextual-space-frontend:$PR_PATH \
    contextual-space-backend:$PR_PATH \
    -c "$CLUSTER_NAME"

# Create namespace
echo ""
echo "📁 Creating namespace $NAMESPACE..."
kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

# Apply Kubernetes manifests
echo ""
echo "📋 Deploying to Kubernetes..."

# ConfigMap
kubectl apply -n "$NAMESPACE" -f - <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: backend-config
  labels:
    app: contextual-space
data:
  dynamodb-table: "contextual-space-preview"
  pr-number: "$PR_NUMBER"
EOF

# Backend Deployment
kubectl apply -n "$NAMESPACE" -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  labels:
    app: contextual-space
    component: backend
spec:
  replicas: 1
  selector:
    matchLabels:
      app: contextual-space
      component: backend
  template:
    metadata:
      labels:
        app: contextual-space
        component: backend
    spec:
      containers:
        - name: backend
          image: contextual-space-backend:$PR_PATH
          imagePullPolicy: IfNotPresent
          ports:
            - containerPort: 3001
              name: http
          env:
            - name: PORT
              value: "3001"
            - name: NODE_ENV
              value: "production"
            - name: FRONTEND_URL
              value: "*"
            - name: PR_NUMBER
              value: "$PR_NUMBER"
          resources:
            requests:
              memory: "128Mi"
              cpu: "100m"
            limits:
              memory: "256Mi"
              cpu: "500m"
          livenessProbe:
            httpGet:
              path: /health
              port: 3001
            initialDelaySeconds: 10
            periodSeconds: 30
          readinessProbe:
            httpGet:
              path: /health
              port: 3001
            initialDelaySeconds: 5
            periodSeconds: 10
EOF

# Backend Service
kubectl apply -n "$NAMESPACE" -f - <<EOF
apiVersion: v1
kind: Service
metadata:
  name: backend
  labels:
    app: contextual-space
    component: backend
spec:
  selector:
    app: contextual-space
    component: backend
  ports:
    - port: 3001
      targetPort: 3001
      protocol: TCP
      name: http
  type: ClusterIP
EOF

# Frontend Deployment
kubectl apply -n "$NAMESPACE" -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  labels:
    app: contextual-space
    component: frontend
spec:
  replicas: 1
  selector:
    matchLabels:
      app: contextual-space
      component: frontend
  template:
    metadata:
      labels:
        app: contextual-space
        component: frontend
    spec:
      containers:
        - name: frontend
          image: contextual-space-frontend:$PR_PATH
          imagePullPolicy: IfNotPresent
          ports:
            - containerPort: 80
              name: http
          resources:
            requests:
              memory: "64Mi"
              cpu: "50m"
            limits:
              memory: "128Mi"
              cpu: "200m"
          livenessProbe:
            httpGet:
              path: /health
              port: 80
            initialDelaySeconds: 10
            periodSeconds: 30
          readinessProbe:
            httpGet:
              path: /health
              port: 80
            initialDelaySeconds: 5
            periodSeconds: 10
EOF

# Frontend Service
kubectl apply -n "$NAMESPACE" -f - <<EOF
apiVersion: v1
kind: Service
metadata:
  name: frontend
  labels:
    app: contextual-space
    component: frontend
spec:
  selector:
    app: contextual-space
    component: frontend
  ports:
    - port: 80
      targetPort: 80
      protocol: TCP
      name: http
  type: ClusterIP
EOF

# Ingress for Socket.IO (with path rewriting)
kubectl apply -n "$NAMESPACE" -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: contextual-space-socket
  annotations:
    nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"
    nginx.ingress.kubernetes.io/proxy-http-version: "1.1"
    nginx.ingress.kubernetes.io/use-regex: "true"
    nginx.ingress.kubernetes.io/rewrite-target: /socket.io/\$2
spec:
  ingressClassName: nginx
  rules:
    - http:
        paths:
          - path: /$PR_PATH/socket.io(/|$)(.*)
            pathType: ImplementationSpecific
            backend:
              service:
                name: backend
                port:
                  number: 3001
EOF

# Ingress for Frontend (with path rewriting)
kubectl apply -n "$NAMESPACE" -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: contextual-space-frontend
  annotations:
    nginx.ingress.kubernetes.io/use-regex: "true"
    nginx.ingress.kubernetes.io/rewrite-target: /\$2
spec:
  ingressClassName: nginx
  rules:
    - http:
        paths:
          - path: /$PR_PATH(/|$)(.*)
            pathType: ImplementationSpecific
            backend:
              service:
                name: frontend
                port:
                  number: 80
EOF

# Wait for pods to be ready
echo ""
echo "⏳ Waiting for pods to be ready..."
kubectl wait --namespace "$NAMESPACE" \
    --for=condition=ready pod \
    --selector=app=contextual-space \
    --timeout=120s

# Get pod status
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║   ✅ Preview deployed successfully!                        ║"
echo "╠════════════════════════════════════════════════════════════╣"
echo "║   🌐 Local URL: http://localhost:8080/$PR_PATH/            ║"
echo "║                                                            ║"
echo "║   To expose publicly, run:                                 ║"
echo "║     ngrok http 8080                                        ║"
echo "║   Then access: https://<ngrok-url>/$PR_PATH/               ║"
echo "╠════════════════════════════════════════════════════════════╣"
echo "║   📊 Pod Status:                                           ║"
echo "╚════════════════════════════════════════════════════════════╝"
kubectl get pods -n "$NAMESPACE"
