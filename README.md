# Contextual Space K8s

**Real-time collaborative canvas deployed on Kubernetes with PR Preview Environments**

[![Kubernetes](https://img.shields.io/badge/Kubernetes-326CE5?logo=kubernetes&logoColor=white)](https://kubernetes.io/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)](https://docker.com/)
[![React](https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=black)](https://reactjs.org/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-010101?logo=socket.io&logoColor=white)](https://socket.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://typescriptlang.org/)

This project combines the **Contextual Space** real-time collaboration app with **Kubernetes-based PR preview environments**, demonstrating a complete DevOps workflow for a real application.

## 🎯 What This Project Demonstrates

| Skill | Implementation |
|-------|----------------|
| **Full-Stack Development** | React + TypeScript frontend, Node.js + Socket.IO backend |
| **Containerization** | Multi-stage Docker builds for optimized images |
| **Kubernetes** | Deployments, Services, Ingress, ConfigMaps, Namespaces |
| **WebSocket in K8s** | Socket.IO through Nginx Ingress with sticky sessions |
| **PR Preview Environments** | Isolated namespace per PR with path-based routing |
| **Infrastructure as Code** | Terraform for EKS (production) |
| **CI/CD** | GitHub Actions for automated deployments |

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     KUBERNETES CLUSTER                          │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                   NGINX INGRESS CONTROLLER                  │ │
│  │                                                             │ │
│  │  /pr-1/*  ──────────────►  PR-1 Namespace                  │ │
│  │  /pr-2/*  ──────────────►  PR-2 Namespace                  │ │
│  │  /pr-N/*  ──────────────►  PR-N Namespace (isolated)       │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                   │
│          ┌───────────────────┼───────────────────┐              │
│          ▼                   ▼                   ▼              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │ PR-1 NS      │    │ PR-2 NS      │    │ PR-N NS      │      │
│  │              │    │              │    │              │      │
│  │ ┌──────────┐ │    │ ┌──────────┐ │    │ ┌──────────┐ │      │
│  │ │ Frontend │ │    │ │ Frontend │ │    │ │ Frontend │ │      │
│  │ │ (React)  │ │    │ │ (React)  │ │    │ │ (React)  │ │      │
│  │ └──────────┘ │    │ └──────────┘ │    │ └──────────┘ │      │
│  │ ┌──────────┐ │    │ ┌──────────┐ │    │ ┌──────────┐ │      │
│  │ │ Backend  │ │    │ │ Backend  │ │    │ │ Backend  │ │      │
│  │ │(Socket.IO│ │    │ │(Socket.IO│ │    │ │(Socket.IO│ │      │
│  │ └──────────┘ │    │ └──────────┘ │    │ └──────────┘ │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

### How Multiple PRs Work

Each Pull Request gets its own:
- **Namespace**: `pr-{number}` - Complete isolation from other PRs
- **Frontend Pod**: React app built with PR-specific base path
- **Backend Pod**: Socket.IO server with PR-specific configuration
- **Ingress Rules**: Routes `/pr-{number}/*` to the correct namespace

This means:
- PR #1 users only see PR #1 changes at `/pr-1/`
- PR #2 users only see PR #2 changes at `/pr-2/`
- WebSocket connections are isolated per preview
- Data modifications don't affect other previews

## 🚀 Quick Start

### Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| [Docker Desktop](https://docker.com/products/docker-desktop) | Latest | Container runtime |
| [WSL2](https://docs.microsoft.com/en-us/windows/wsl/install) | Ubuntu 24.04 | Linux environment |
| [k3d](https://k3d.io/) | v5.x | Local Kubernetes |
| [kubectl](https://kubernetes.io/docs/tasks/tools/) | v1.28+ | K8s CLI |
| [ngrok](https://ngrok.com/) | v3.x | Public tunneling |

### Installation (Windows + WSL2)

```powershell
# Install k3d in WSL
wsl -d Ubuntu-24.04 -e bash -c "curl -s https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh | bash"

# Install ngrok (Windows)
winget install ngrok.ngrok
ngrok config add-authtoken YOUR_TOKEN
```

### 1. Create Local Cluster

**PowerShell:**
```powershell
.\scripts\local\Create-Cluster.ps1
```

**WSL/Bash:**
```bash
./scripts/local/create-cluster.sh
```

This creates a k3d cluster with:
- Nginx Ingress Controller (Traefik disabled)
- Port 8080 mapped to ingress (Windows blocks port 80)
- Port 8443 for HTTPS

### 2. Deploy a Preview

**PowerShell:**
```powershell
# Deploy PR #42
.\scripts\local\Deploy-Preview.ps1 -PRNumber 42

# Access at: http://localhost:8080/pr-42/
```

**WSL/Bash:**
```bash
./scripts/local/deploy-preview.sh 42
```

### 3. Deploy Multiple Previews

```powershell
# Deploy multiple PRs
.\scripts\local\Deploy-Preview.ps1 -PRNumber 1
.\scripts\local\Deploy-Preview.ps1 -PRNumber 2
.\scripts\local\Deploy-Preview.ps1 -PRNumber 3

# Each has its own isolated canvas:
# http://localhost:8080/pr-1/
# http://localhost:8080/pr-2/
# http://localhost:8080/pr-3/
```

### 4. Expose Publicly with ngrok

```powershell
# Start ngrok (in PowerShell, not WSL)
ngrok http 8080

# Share the public URL:
# https://your-subdomain.ngrok-free.dev/pr-42/
```

### 5. List Active Previews

```powershell
.\scripts\local\List-Previews.ps1
```

### 6. Delete a Preview

```powershell
.\scripts\local\Delete-Preview.ps1 -PRNumber 42
```

## 📁 Project Structure

```
Contextual_Space_K8s/
├── apps/
│   ├── frontend/              # React + Vite + TailwindCSS
│   │   ├── src/
│   │   │   ├── components/    # Canvas, TextBox, Cursors
│   │   │   ├── hooks/         # useSocket hook
│   │   │   └── services/      # Socket.IO client (K8s-aware)
│   │   ├── Dockerfile         # Multi-stage build
│   │   └── nginx.conf         # SPA routing
│   └── backend/               # Node.js + Express + Socket.IO
│       ├── src/
│       │   ├── socket/        # WebSocket handlers
│       │   └── store/         # In-memory + DynamoDB
│       └── Dockerfile         # Multi-stage build
├── k8s/
│   └── base/                  # Base Kubernetes manifests
│       ├── frontend-deployment.yaml
│       ├── backend-deployment.yaml
│       ├── frontend-service.yaml
│       ├── backend-service.yaml
│       ├── ingress.yaml
│       └── kustomization.yaml
├── scripts/
│   └── local/                 # Local development scripts
│       ├── Create-Cluster.ps1     # PowerShell
│       ├── Deploy-Preview.ps1     # PowerShell
│       ├── Delete-Preview.ps1     # PowerShell
│       ├── List-Previews.ps1      # PowerShell
│       ├── create-cluster.sh      # Bash
│       ├── deploy-preview.sh      # Bash
│       ├── delete-preview.sh      # Bash
│       └── list-previews.sh       # Bash
├── infrastructure/
│   └── terraform/             # EKS infrastructure (Phase 2)
├── .github/
│   └── workflows/             # CI/CD pipelines
└── docs/
    ├── LOCAL_SETUP.md         # Detailed local setup
    └── EKS_SETUP.md           # AWS EKS deployment
```

## 🎮 Application Features

### Collaborative Canvas
- **Real-time Cursors**: See other users' cursors moving in real-time
- **Text Boxes**: Create, edit, drag, and resize text boxes
- **Multi-user**: Multiple users can collaborate simultaneously
- **Persistence**: Changes are synced across all connected clients

### Preview Environments
- **Isolation**: Each PR has its own namespace and data
- **WebSocket Support**: Full Socket.IO functionality through Ingress
- **Auto-cleanup**: Delete preview when PR is merged/closed
- **Public Access**: Expose via ngrok for stakeholder review

## 🔧 How It Works

### Path-Based Routing

The Nginx Ingress Controller routes requests based on URL path:

```
http://localhost:8080/pr-42/           → pr-42 namespace frontend
http://localhost:8080/pr-42/socket.io  → pr-42 namespace backend
http://localhost:8080/pr-99/           → pr-99 namespace frontend
http://localhost:8080/pr-99/socket.io  → pr-99 namespace backend
```

### WebSocket Configuration

Socket.IO requires special handling in Kubernetes:

1. **Path Rewriting**: `/pr-N/socket.io` → `/socket.io`
2. **Sticky Sessions**: WebSocket upgrades need consistent backend
3. **Timeout Settings**: Long-lived connections (3600s)

```yaml
annotations:
  nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
  nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"
  nginx.ingress.kubernetes.io/use-regex: "true"
  nginx.ingress.kubernetes.io/rewrite-target: /socket.io/$2
```

### Frontend Base Path Injection

The frontend is built with a PR-specific base path:

```dockerfile
ARG VITE_BASE_PATH="/pr-42/"
ENV VITE_BASE_PATH=$VITE_BASE_PATH
RUN npm run build
```

The Socket.IO client automatically detects the base path:

```typescript
const BASE_PATH = import.meta.env.VITE_BASE_PATH || '/';
const getSocketPath = () => BASE_PATH !== '/' ? BASE_PATH + 'socket.io' : '/socket.io';
```

## 🧪 Local Development (Without Kubernetes)

```bash
# Backend
cd apps/backend
npm install
npm run dev  # http://localhost:3001

# Frontend (new terminal)
cd apps/frontend
npm install
npm run dev  # http://localhost:5173
```

## ☁️ AWS EKS Deployment (Production)

See [docs/EKS_SETUP.md](docs/EKS_SETUP.md) for production deployment with:
- EKS cluster with managed node groups
- AWS Load Balancer Controller
- ECR for container images
- GitHub Actions with OIDC authentication

## 🔗 Related Projects

- [Contextual Space](https://github.com/NikolaGospodjinacki/Contextual_Space) - Original standalone version with CloudFront/S3/App Runner
- [PR Preview Environments](https://github.com/NikolaGospodjinacki/PR_Preview_Environments) - Generic preview environment template

## 📜 License

MIT
