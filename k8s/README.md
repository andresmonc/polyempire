# Kubernetes Deployment Guide

This directory contains Kubernetes manifests for deploying PolyEmpire as a single unified service (Express serves both API and static frontend files).

## Prerequisites

- Kubernetes cluster (v1.20+)
- kubectl configured to access your cluster
- Docker image built and pushed to a registry (or use local image)

## Quick Start

### 1. Build Docker Image

The Dockerfile builds both the frontend (Vite) and backend (Express) into a single image:

```bash
docker build -t polyempire:latest .
```

### 2. Push Image to Registry (if using remote registry)

```bash
# Tag image for your registry
docker tag polyempire:latest your-registry/polyempire:latest

# Push image
docker push your-registry/polyempire:latest
```

### 3. Update Image Reference

If using a remote registry, update the image name in `deployment.yaml`.

### 4. Deploy to Kubernetes

#### Option A: Using kubectl directly

```bash
# Create namespace
kubectl apply -f namespace.yaml

# Deploy application
kubectl apply -f deployment.yaml

# Deploy ingress (configure hostname first)
kubectl apply -f ingress.yaml
```

#### Option B: Using kustomize

```bash
kubectl apply -k .
```

## Architecture

- **Single Service**: Express server handles both API (`/api/*`) and static frontend files
- **SPA Routing**: All non-API routes serve `index.html` for client-side routing
- **Health Checks**: `/health` endpoint for Kubernetes probes

## Configuration

### Ingress

Edit `ingress.yaml` to configure:
- Hostname (change `polyempire.local` to your domain)
- Ingress controller annotations
- TLS/SSL certificates

### Resource Limits

Adjust CPU and memory limits in `deployment.yaml`.

### Replicas

Change the number of replicas in `deployment.yaml` to scale horizontally.

## Accessing the Application

After deployment:

1. Check service endpoints:
   ```bash
   kubectl get svc -n polyempire
   ```

2. Port forward for local testing:
   ```bash
   kubectl port-forward -n polyempire svc/polyempire 3000:3000
   ```
   Then access at http://localhost:3000

3. Access via ingress (after configuring):
   - Frontend: http://your-domain/
   - API: http://your-domain/api/games

## Health Checks

The deployment includes health check endpoints:
- `/health` - Used by Kubernetes liveness and readiness probes

## Troubleshooting

### Check pod status
```bash
kubectl get pods -n polyempire
```

### View logs
```bash
kubectl logs -n polyempire -l app=polyempire
```

### Describe resources
```bash
kubectl describe deployment -n polyempire polyempire
```

### Check if static files are being served
```bash
# Exec into a pod
kubectl exec -n polyempire -it deployment/polyempire -- sh

# Check if dist folder exists
ls -la dist/
```

## Cleanup

To remove all resources:

```bash
kubectl delete -k .
# or
kubectl delete namespace polyempire
```

