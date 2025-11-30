# Deploy a Contextual Space preview environment (PowerShell wrapper)
# Usage: .\Deploy-Preview.ps1 -PRNumber <NUMBER> [-ClusterName <NAME>]

param(
    [Parameter(Mandatory=$true)]
    [int]$PRNumber,
    
    [Parameter(Mandatory=$false)]
    [string]$ClusterName = "pr-previews"
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   🚀 Deploying Contextual Space Preview                    ║" -ForegroundColor Cyan
Write-Host "╠════════════════════════════════════════════════════════════╣" -ForegroundColor Cyan
Write-Host "║   PR Number:  #$PRNumber" -ForegroundColor Cyan
Write-Host "║   Namespace:  pr-$PRNumber" -ForegroundColor Cyan
Write-Host "║   Cluster:    $ClusterName" -ForegroundColor Cyan
Write-Host "║   URL:        http://localhost:8080/pr-$PRNumber/" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $ScriptDir)
$PRPath = "pr-$PRNumber"
$Namespace = "pr-$PRNumber"

# Build Docker images
Write-Host "📦 Building Docker images..." -ForegroundColor Yellow
Write-Host ""

Write-Host "  → Building frontend with base path /$PRPath/..." -ForegroundColor Gray
docker build `
    --build-arg VITE_BASE_PATH="/$PRPath/" `
    --build-arg VITE_SOCKET_URL="" `
    -t "contextual-space-frontend:$PRPath" `
    "$ProjectRoot\apps\frontend"

if ($LASTEXITCODE -ne 0) { throw "Frontend build failed" }

Write-Host ""
Write-Host "  → Building backend..." -ForegroundColor Gray
docker build `
    -t "contextual-space-backend:$PRPath" `
    "$ProjectRoot\apps\backend"

if ($LASTEXITCODE -ne 0) { throw "Backend build failed" }

# Import images to k3d (via WSL)
Write-Host ""
Write-Host "📤 Importing images to k3d cluster '$ClusterName'..." -ForegroundColor Yellow
wsl -d Ubuntu-24.04 -e bash -c "k3d image import contextual-space-frontend:$PRPath contextual-space-backend:$PRPath -c $ClusterName"

if ($LASTEXITCODE -ne 0) { throw "Image import failed" }

# Create namespace and deploy (via WSL)
Write-Host ""
Write-Host "📋 Deploying to Kubernetes..." -ForegroundColor Yellow

$DeployScript = @"
kubectl create namespace $Namespace --dry-run=client -o yaml | kubectl apply -f -

kubectl apply -n $Namespace -f - <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: backend-config
data:
  pr-number: "$PRNumber"
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
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
          image: contextual-space-backend:$PRPath
          imagePullPolicy: IfNotPresent
          ports:
            - containerPort: 3001
          env:
            - name: PORT
              value: "3001"
            - name: FRONTEND_URL
              value: "*"
            - name: PR_NUMBER
              value: "$PRNumber"
---
apiVersion: v1
kind: Service
metadata:
  name: backend
spec:
  selector:
    app: contextual-space
    component: backend
  ports:
    - port: 3001
      targetPort: 3001
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
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
          image: contextual-space-frontend:$PRPath
          imagePullPolicy: IfNotPresent
          ports:
            - containerPort: 80
---
apiVersion: v1
kind: Service
metadata:
  name: frontend
spec:
  selector:
    app: contextual-space
    component: frontend
  ports:
    - port: 80
      targetPort: 80
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: contextual-space-socket
  annotations:
    nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"
    nginx.ingress.kubernetes.io/use-regex: "true"
    nginx.ingress.kubernetes.io/rewrite-target: /socket.io/\\\$2
spec:
  ingressClassName: nginx
  rules:
    - http:
        paths:
          - path: /$PRPath/socket.io(/|\$)(.*)
            pathType: ImplementationSpecific
            backend:
              service:
                name: backend
                port:
                  number: 3001
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: contextual-space-frontend
  annotations:
    nginx.ingress.kubernetes.io/use-regex: "true"
    nginx.ingress.kubernetes.io/rewrite-target: /\\\$2
spec:
  ingressClassName: nginx
  rules:
    - http:
        paths:
          - path: /$PRPath(/|\$)(.*)
            pathType: ImplementationSpecific
            backend:
              service:
                name: frontend
                port:
                  number: 80
EOF
"@

wsl -d Ubuntu-24.04 -e bash -c $DeployScript

# Wait for pods
Write-Host ""
Write-Host "⏳ Waiting for pods to be ready..." -ForegroundColor Yellow
wsl -d Ubuntu-24.04 -e bash -c "kubectl wait --namespace $Namespace --for=condition=ready pod --selector=app=contextual-space --timeout=120s"

# Show status
Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║   ✅ Preview deployed successfully!                        ║" -ForegroundColor Green
Write-Host "╠════════════════════════════════════════════════════════════╣" -ForegroundColor Green
Write-Host "║   🌐 Local URL: http://localhost:8080/$PRPath/             ║" -ForegroundColor Green
Write-Host "║                                                            ║" -ForegroundColor Green
Write-Host "║   To expose publicly, run:                                 ║" -ForegroundColor Green
Write-Host "║     ngrok http 8080                                        ║" -ForegroundColor Green
Write-Host "║   Then access: https://<ngrok-url>/$PRPath/                ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

wsl -d Ubuntu-24.04 -e bash -c "kubectl get pods -n $Namespace"
