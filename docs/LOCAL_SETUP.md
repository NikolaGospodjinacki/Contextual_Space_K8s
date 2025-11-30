# Local Development Setup

This guide covers setting up local PR preview environments using k3d (Kubernetes in Docker).

## Prerequisites

### Windows with WSL2

1. **Docker Desktop** with WSL2 backend
   ```powershell
   # Verify Docker is running
   docker --version
   docker ps
   ```

2. **WSL2 with Ubuntu**
   ```powershell
   wsl --install -d Ubuntu-24.04
   ```

3. **k3d** (Kubernetes in Docker)
   ```bash
   # In WSL
   curl -s https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh | bash
   k3d --version
   ```

4. **kubectl**
   ```bash
   # In WSL
   curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
   sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
   ```

5. **ngrok** (for public access)
   ```powershell
   # Windows
   winget install ngrok.ngrok
   ngrok config add-authtoken YOUR_TOKEN
   ```

## Quick Start

### Step 1: Create the Cluster

```powershell
# PowerShell
.\scripts\local\Create-Cluster.ps1
```

Or in WSL:
```bash
./scripts/local/create-cluster.sh
```

This creates:
- k3d cluster named `pr-previews`
- Nginx Ingress Controller
- Port mappings: 8080 (HTTP), 8443 (HTTPS)

### Step 2: Deploy Your First Preview

```powershell
.\scripts\local\Deploy-Preview.ps1 -PRNumber 1
```

This will:
1. Build frontend Docker image with base path `/pr-1/`
2. Build backend Docker image
3. Import images to k3d
4. Create namespace `pr-1`
5. Deploy pods, services, and ingress
6. Wait for pods to be ready

### Step 3: Access the Preview

Open in browser: http://localhost:8080/pr-1/

### Step 4: Expose Publicly (Optional)

```powershell
# In PowerShell (not WSL!)
ngrok http 8080
```

Share the ngrok URL: `https://xxx.ngrok-free.dev/pr-1/`

## Multiple Previews

Deploy multiple PRs simultaneously:

```powershell
.\scripts\local\Deploy-Preview.ps1 -PRNumber 1
.\scripts\local\Deploy-Preview.ps1 -PRNumber 2
.\scripts\local\Deploy-Preview.ps1 -PRNumber 3
```

Each runs in complete isolation:
- http://localhost:8080/pr-1/ (PR #1's changes)
- http://localhost:8080/pr-2/ (PR #2's changes)
- http://localhost:8080/pr-3/ (PR #3's changes)

## Managing Previews

### List All Previews

```powershell
.\scripts\local\List-Previews.ps1
```

Output:
```
📋 Active Preview Environments
══════════════════════════════════════════════════════════════

🔹 PR #1
   URL: http://localhost:8080/pr-1/
   Pods:
      backend-xxx    1/1   Running
      frontend-xxx   1/1   Running

🔹 PR #2
   URL: http://localhost:8080/pr-2/
   Pods:
      backend-xxx    1/1   Running
      frontend-xxx   1/1   Running
```

### Delete a Preview

```powershell
.\scripts\local\Delete-Preview.ps1 -PRNumber 1
```

### View Logs

```powershell
# Backend logs
wsl -d Ubuntu-24.04 -e bash -c "kubectl logs -n pr-1 deploy/backend -f"

# Frontend logs
wsl -d Ubuntu-24.04 -e bash -c "kubectl logs -n pr-1 deploy/frontend -f"
```

### Check Pod Status

```powershell
wsl -d Ubuntu-24.04 -e bash -c "kubectl get pods -n pr-1"
```

## Troubleshooting

### Port 8080 Already in Use

```powershell
# Find what's using port 8080
netstat -ano | findstr ":8080"

# Kill the process or use a different port in create-cluster.sh
```

### Cluster Won't Start

```powershell
# Check Docker is running
docker ps

# Delete and recreate cluster
wsl -d Ubuntu-24.04 -e bash -c "k3d cluster delete pr-previews"
.\scripts\local\Create-Cluster.ps1
```

### WebSocket Not Connecting

1. Check backend logs for errors
2. Verify ingress is configured:
   ```bash
   kubectl get ingress -n pr-1
   ```
3. Test Socket.IO polling:
   ```powershell
   curl http://localhost:8080/pr-1/socket.io/?EIO=4&transport=polling
   ```

### Image Not Updating

```powershell
# Rebuild without cache
docker build --no-cache -t contextual-space-frontend:pr-1 .\apps\frontend

# Re-import to k3d
wsl -d Ubuntu-24.04 -e bash -c "k3d image import contextual-space-frontend:pr-1 -c pr-previews"

# Restart deployment
wsl -d Ubuntu-24.04 -e bash -c "kubectl rollout restart deployment/frontend -n pr-1"
```

## Architecture Details

### Why k3d?

k3d runs k3s (lightweight Kubernetes) inside Docker containers, making it:
- Fast to start/stop
- Easy to manage multiple clusters
- Perfect for local development
- Compatible with Docker Desktop

### Why Nginx Ingress?

k3s includes Traefik by default, but we disable it because:
- Nginx has better WebSocket support
- More configuration options
- Industry standard

### Port 8080 Instead of 80

Windows often blocks port 80 for:
- IIS
- Skype
- Other services

Port 8080 works reliably on all systems.

## Next Steps

Once local development is working, see [EKS_SETUP.md](EKS_SETUP.md) for production deployment on AWS.
