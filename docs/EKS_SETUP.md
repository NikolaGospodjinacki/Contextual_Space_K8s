# AWS EKS Production Setup

This guide covers deploying PR preview environments to Amazon EKS for production use.

## Overview

Production deployment uses:
- **Amazon EKS**: Managed Kubernetes cluster
- **Amazon ECR**: Container image registry
- **AWS Load Balancer Controller**: ALB for ingress
- **GitHub Actions**: CI/CD with OIDC authentication
- **Terraform**: Infrastructure as Code

## Cost Estimates

| Resource | On-Demand | With Spot | Notes |
|----------|-----------|-----------|-------|
| EKS Control Plane | $0.10/hr ($73/mo) | $0.10/hr | Fixed cost |
| t3.medium nodes (2) | $0.0416/hr ($60/mo) | ~$0.012/hr (~$18/mo) | 70% savings |
| NAT Gateway | $0.045/hr ($33/mo) | Same | Consider NAT Instance |
| ALB | $0.0225/hr ($16/mo) | Same | Plus LCU charges |
| **Total** | **~$180/mo** | **~$140/mo** | Idle cluster |

**Cost Optimization Tips:**
- Use Spot instances for preview environments
- Scale to zero when not in use (Karpenter)
- Share cluster across projects
- Use NAT Instance instead of NAT Gateway (~$5/mo)

## Prerequisites

- AWS CLI configured with appropriate permissions
- Terraform v1.0+
- kubectl
- eksctl (optional, for manual operations)

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
terraform init
terraform plan
terraform apply
```

This creates:
- VPC with public/private subnets
- EKS cluster with managed node group
- ECR repositories for frontend/backend
- IAM roles for GitHub Actions OIDC
- AWS Load Balancer Controller

### 3. Configure kubectl

```bash
aws eks update-kubeconfig --region us-east-1 --name contextual-space-k8s-preview
kubectl get nodes
```

## GitHub Actions Setup

### 1. Add Repository Secrets

Go to GitHub → Settings → Secrets and Variables → Actions:

| Secret | Value | Source |
|--------|-------|--------|
| `AWS_REGION` | `us-east-1` | Your choice |
| `AWS_ROLE_ARN` | `arn:aws:iam::xxx:role/...` | Terraform output |
| `ECR_FRONTEND_REPO` | `xxx.dkr.ecr...` | Terraform output |
| `ECR_BACKEND_REPO` | `xxx.dkr.ecr...` | Terraform output |
| `EKS_CLUSTER_NAME` | `contextual-space-k8s-preview` | Terraform output |

### 2. Workflow Triggers

The GitHub Actions workflow triggers on:
- **Pull Request opened/synchronized**: Deploy preview
- **Pull Request closed**: Cleanup preview

## Deployment Workflow

### Automatic (GitHub Actions)

1. Open a Pull Request
2. GitHub Actions builds and deploys to EKS
3. Bot comments with preview URL
4. Merge or close PR to cleanup

### Manual Deployment

```bash
# Build and push images
./scripts/eks/build-and-push.sh 42

# Deploy to EKS
./scripts/eks/deploy-preview.sh 42

# Access via ALB
kubectl get ingress -n pr-42
```

## Ingress Configuration

### AWS Load Balancer Controller

The ALB Ingress provides:
- Automatic SSL via ACM
- Path-based routing
- Health checks
- Auto-scaling

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  annotations:
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
spec:
  rules:
    - http:
        paths:
          - path: /pr-42/*
            backend:
              service:
                name: frontend
                port:
                  number: 80
```

### Custom Domain (Optional)

1. Create ACM certificate
2. Add Route53 record
3. Configure ingress:

```yaml
annotations:
  alb.ingress.kubernetes.io/certificate-arn: arn:aws:acm:...
  alb.ingress.kubernetes.io/listen-ports: '[{"HTTPS":443}]'
  alb.ingress.kubernetes.io/ssl-redirect: '443'
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
  maxReplicas: 3
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
# Install Karpenter
helm install karpenter oci://public.ecr.aws/karpenter/karpenter
```

## Monitoring

### CloudWatch Container Insights

```bash
# Enable via eksctl
eksctl utils update-cluster-logging \
  --enable-types all \
  --cluster contextual-space-k8s-preview
```

### Prometheus + Grafana (Optional)

```bash
helm install prometheus prometheus-community/kube-prometheus-stack
```

## Cleanup

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
