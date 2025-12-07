# =============================================================================
# EKS Module
# =============================================================================
# Using AWS EKS Module for production-ready Kubernetes cluster
# https://registry.terraform.io/modules/terraform-aws-modules/eks/aws
# =============================================================================

module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 19.0"

  cluster_name    = local.cluster_name
  cluster_version = var.cluster_version

  # Networking
  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  # Cluster Access
  cluster_endpoint_public_access  = true
  cluster_endpoint_private_access = true

  # OIDC Provider for IRSA (IAM Roles for Service Accounts)
  enable_irsa = true

  # Cluster Add-ons
  cluster_addons = {
    coredns = {
      most_recent = true
    }
    kube-proxy = {
      most_recent = true
    }
    vpc-cni = {
      most_recent              = true
      before_compute           = true
      service_account_role_arn = module.vpc_cni_irsa.iam_role_arn
      configuration_values = jsonencode({
        env = {
          ENABLE_PREFIX_DELEGATION = "true"
          WARM_PREFIX_TARGET       = "1"
        }
      })
    }
  }

  # Node Groups
  eks_managed_node_groups = {
    main = {
      name            = "main-nodes"
      use_name_prefix = false

      instance_types = var.node_instance_types
      capacity_type  = "ON_DEMAND"

      min_size     = var.node_min_size
      max_size     = var.node_max_size
      desired_size = var.node_desired_size

      disk_size = var.node_disk_size

      # Node Labels
      labels = {
        Environment = var.environment
        NodeGroup   = "main"
      }

      # Node Taints (optional)
      # taints = []

      # Use latest EKS optimized AMI
      ami_type = "AL2_x86_64"

      # Security
      iam_role_additional_policies = {
        AmazonSSMManagedInstanceCore = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
      }

      # Use shorter IAM role name
      iam_role_name            = "cs-eks-node-role"
      iam_role_use_name_prefix = false

      tags = {
        Name = "cs-node"
      }
    }
  }

  # Cluster Security Group Rules
  cluster_security_group_additional_rules = {
    ingress_nodes_ephemeral_ports_tcp = {
      description                = "Nodes to cluster API"
      protocol                   = "tcp"
      from_port                  = 1025
      to_port                    = 65535
      type                       = "ingress"
      source_node_security_group = true
    }
  }

  # Node Security Group Rules
  node_security_group_additional_rules = {
    ingress_self_all = {
      description = "Node to node all ports/protocols"
      protocol    = "-1"
      from_port   = 0
      to_port     = 0
      type        = "ingress"
      self        = true
    }
    ingress_cluster_all = {
      description                   = "Cluster to node all ports/protocols"
      protocol                      = "-1"
      from_port                     = 0
      to_port                       = 0
      type                          = "ingress"
      source_cluster_security_group = true
    }
  }

  # aws-auth ConfigMap
  manage_aws_auth_configmap = true

  aws_auth_roles = [
    {
      rolearn  = aws_iam_role.github_actions.arn
      username = "github-actions"
      groups   = ["system:masters"]
    }
  ]

  tags = {
    Name = local.cluster_name
  }
}

# =============================================================================
# VPC CNI IRSA (IAM Role for Service Account)
# =============================================================================

module "vpc_cni_irsa" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version = "~> 5.0"

  role_name             = "${local.name}-vpc-cni-irsa"
  attach_vpc_cni_policy = true
  vpc_cni_enable_ipv4   = true

  oidc_providers = {
    main = {
      provider_arn               = module.eks.oidc_provider_arn
      namespace_service_accounts = ["kube-system:aws-node"]
    }
  }

  tags = {
    Name = "${local.name}-vpc-cni-irsa"
  }
}

# =============================================================================
# EBS CSI Driver IRSA (for persistent volumes)
# =============================================================================

module "ebs_csi_irsa" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version = "~> 5.0"

  role_name             = "${local.name}-ebs-csi-irsa"
  attach_ebs_csi_policy = true

  oidc_providers = {
    main = {
      provider_arn               = module.eks.oidc_provider_arn
      namespace_service_accounts = ["kube-system:ebs-csi-controller-sa"]
    }
  }

  tags = {
    Name = "${local.name}-ebs-csi-irsa"
  }
}
