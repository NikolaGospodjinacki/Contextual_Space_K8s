# AWS EKS Production Setup

This guide covers deploying PR preview environments to Amazon EKS for production use.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AWS Cloud                                       │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                            VPC (10.0.0.0/16)                           │  │
│  │                                                                         │  │
│  │  ┌─────────────────────┐          ┌─────────────────────┐             │  │
│  │  │   Public Subnet     │          │   Public Subnet     │             │  │
│  │  │   (10.0.101.0/24)   │          │   (10.0.102.0/24)   │             │  │
│  │  │                     │          │                     │             │  │
│  │  │  ┌──────────────┐   │          │                     │             │  │
│  │  │  │ NAT Gateway  │   │          │                     │             │  │
│  │  │  └──────────────┘   │          │                     │             │  │
│  │  └─────────────────────┘          └─────────────────────┘             │  │
│  │           │                                                            │  │
│  │           ▼                                                            │  │
│  │  ┌─────────────────────┐          ┌─────────────────────┐             │  │
│  │  │  Private Subnet     │          │  Private Subnet     │             │  │
│  │  │  (10.0.1.0/24)      │          │  (10.0.2.0/24)      │             │  │
│  │  │                     │          │                     │             │  │
│  │  │  ┌──────────────┐   │          │  ┌──────────────┐   │             │  │
│  │  │  │  EKS Node    │   │          │  │  EKS Node    │   │             │  │
│  │  │  │  (t3.medium) │   │          │  │  (t3.medium) │   │             │  │
│  │  │  └──────────────┘   │          │  └──────────────┘   │             │  │
│  │  └─────────────────────┘          └─────────────────────┘             │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │  ECR Frontend   │    │  ECR Backend    │    │  EKS Control    │         │
│  │  Repository     │    │  Repository     │    │  Plane          │         │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ OIDC Authentication
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           GitHub Actions                                     │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│  │ PR Preview   │    │ PR Cleanup   │    │ CI/CD        │                  │
│  │ Workflow     │    │ Workflow     │    │ Pipeline     │                  │
│  └──────────────┘    └──────────────┘    └──────────────┘                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Overview

Production deployment uses:
- **Amazon EKS**: Managed Kubernetes cluster
- **Amazon ECR**: Container image registry
- **Nginx Ingress Controller**: For consistent routing with local setup
- **AWS Load Balancer Controller**: NLB for ingress controller service
- **GitHub Actions**: CI/CD with OIDC authentication (no long-lived credentials!)
- **Terraform**: Infrastructure as Code

## Cost Estimates

| Resource | On-Demand | With Spot | Notes |
|----------|-----------|-----------|-------|
| EKS Control Plane | $0.10/hr ($73/mo) | $0.10/hr | Fixed cost |
| t3.medium nodes (2) | $0.0416/hr ($60/mo) | ~$0.012/hr (~$18/mo) | 70% savings |
| NAT Gateway | $0.045/hr ($33/mo) | Same | Consider NAT Instance |
| NLB | $0.0225/hr ($16/mo) | Same | Plus LCU charges |
| **Total** | **~$180/mo** | **~$140/mo** | Idle cluster |

**Cost Optimization Tips:**
- Use Spot instances for preview environments
- Scale to zero when not in use (Karpenter)
- Share cluster across projects
- Use NAT Instance instead of NAT Gateway (~$5/mo)
- Destroy cluster when not demoing

## Prerequisites

- AWS CLI configured with appropriate permissions
- Terraform v1.0+
- kubectl
- GitHub CLI (gh) - for setting secrets

## Infrastructure Setup

### 1. Configure Terraform Variables

```bash
cd infrastructure/terraform
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars`:
```hcl
aws_region     = "us-east-1"
project_name   = "contextual-space-k8s"
environment    = "preview"
github_org     = "YourGitHubUsername"
github_repo    = "Contextual_Space_K8s"
```

### 2. Initialize and Apply

```bash
cd infrastructure/terraform
terraform init
terraform plan
terraform apply
```

This creates:
- VPC with public/private subnets across 2 AZs
- EKS cluster with managed node group (2 x t3.medium)
- ECR repositories for frontend/backend images
- GitHub OIDC provider for secure authentication
- IAM roles for GitHub Actions deployments
- AWS Load Balancer Controller
- Nginx Ingress Controller (for consistency with local setup)

### 3. Get Terraform Outputs

```bash
terraform output
```

Save these values for GitHub Actions secrets:
- `github_actions_role_arn`
- `ecr_frontend_repository_url`
- `ecr_backend_repository_url`
- `cluster_name`

### 4. Configure kubectl

```bash
aws eks update-kubeconfig --region us-east-1 --name contextual-space-eks-dev
kubectl get nodes
```

## GitHub Actions Setup

### 1. Add Repository Secrets

Using GitHub CLI:

```bash
gh secret set AWS_REGION --body "us-east-1"
gh secret set AWS_ROLE_ARN --body "$(terraform output -raw github_actions_role_arn)"
gh secret set EKS_CLUSTER_NAME --body "$(terraform output -raw cluster_name)"
gh secret set ECR_FRONTEND_REPO --body "$(terraform output -raw ecr_frontend_repository_url)"
gh secret set ECR_BACKEND_REPO --body "$(terraform output -raw ecr_backend_repository_url)"
```

Or manually via GitHub UI → Settings → Secrets and Variables → Actions:

| Secret | Value | Source |
|--------|-------|--------|
| `AWS_REGION` | `us-east-1` | Your choice |
| `AWS_ROLE_ARN` | `arn:aws:iam::xxx:role/contextual-space-dev-github-actions` | Terraform output |
| `ECR_FRONTEND_REPO` | `xxx.dkr.ecr.us-east-1.amazonaws.com/contextual-space/frontend` | Terraform output |
| `ECR_BACKEND_REPO` | `xxx.dkr.ecr.us-east-1.amazonaws.com/contextual-space/backend` | Terraform output |
| `EKS_CLUSTER_NAME` | `contextual-space-eks-dev` | Terraform output |

### 2. Workflow Triggers

The GitHub Actions workflows trigger on:
- **PR opened/synchronized**: Deploy preview to `pr-{number}` namespace
- **PR closed**: Cleanup preview namespace and ECR images
- **Push to main**: Deploy to `production` namespace

## Deployment Workflow

### Automatic (GitHub Actions)

1. Open a Pull Request against `main`
2. GitHub Actions automatically:
   - Builds Docker images
   - Pushes to ECR
   - Deploys to EKS in `pr-{number}` namespace
   - Comments on PR with preview URL
3. Merge or close PR to trigger cleanup

### Manual Deployment

```bash
# Get cluster credentials
aws eks update-kubeconfig --region us-east-1 --name contextual-space-eks-dev

# Build and push images manually
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com

docker build -t YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/contextual-space/frontend:pr-42 \
  --build-arg VITE_BASE_PATH=/pr-42/ \
  ./apps/frontend

docker push YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/contextual-space/frontend:pr-42

# Apply manifests
kubectl create namespace pr-42
kubectl apply -n pr-42 -f k8s/base/
```

## Ingress Configuration

### Nginx Ingress Controller

The Terraform setup deploys Nginx Ingress Controller behind an NLB for consistency with the local k3d setup:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: contextual-space
  annotations:
    nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"
    nginx.ingress.kubernetes.io/use-regex: "true"
    nginx.ingress.kubernetes.io/rewrite-target: /$2
spec:
  ingressClassName: nginx
  rules:
    - http:
        paths:
          - path: /pr-42/socket.io(/|$)(.*)
            pathType: ImplementationSpecific
            backend:
              service:
                name: backend
                port:
                  number: 3001
          - path: /pr-42(/|$)(.*)
            pathType: ImplementationSpecific
            backend:
              service:
                name: frontend
                port:
                  number: 80
```

### Get Ingress URL

```bash
kubectl get svc -n ingress-nginx ingress-nginx-controller -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'
```

### Custom Domain (Optional)

1. Create ACM certificate for your domain
2. Add Route53 CNAME record pointing to NLB hostname
3. Configure ingress with TLS:

```yaml
spec:
  tls:
    - hosts:
        - preview.yourdomain.com
      secretName: tls-secret
  rules:
    - host: preview.yourdomain.com
      http:
        paths:
          # ... same as above
```

## Scaling

### Horizontal Pod Autoscaler

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: backend-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: backend
  minReplicas: 1
  maxReplicas: 5
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

### Karpenter (Advanced)

For automatic node scaling and spot instance management:

```bash
# Install Karpenter (already configured in Terraform)
helm install karpenter oci://public.ecr.aws/karpenter/karpenter
```

## Monitoring

### CloudWatch Container Insights

```bash
# Enable via eksctl
eksctl utils update-cluster-logging \
  --enable-types all \
  --cluster contextual-space-eks-dev
```

### View Logs

```bash
# Backend logs
kubectl logs -n pr-42 -l app=backend -f

# Frontend logs
kubectl logs -n pr-42 -l app=frontend -f
```

## Cleanup

### Delete Single Preview

```bash
kubectl delete namespace pr-42
```

### Delete All Preview Namespaces

```bash
kubectl get ns | grep "pr-" | awk '{print $1}' | xargs kubectl delete ns
```

### Destroy Infrastructure

```bash
cd infrastructure/terraform
terraform destroy
```

## Security Best Practices

1. **Network Policies**: Isolate namespaces
2. **Pod Security Standards**: Enforce restricted policies
3. **Secrets Management**: Use AWS Secrets Manager or External Secrets
4. **RBAC**: Limit GitHub Actions role permissions
5. **Image Scanning**: Enable ECR image scanning

## Troubleshooting

### ALB Not Creating

```bash
# Check controller logs
kubectl logs -n kube-system -l app.kubernetes.io/name=aws-load-balancer-controller

# Verify IAM permissions
aws iam get-role-policy --role-name <controller-role>
```

### Pods Not Scheduling

```bash
# Check node capacity
kubectl describe nodes

# Check pod events
kubectl describe pod -n pr-42 <pod-name>
```

### WebSocket Issues

Ensure ALB idle timeout is sufficient:
```yaml
annotations:
  alb.ingress.kubernetes.io/load-balancer-attributes: idle_timeout.timeout_seconds=3600
```
