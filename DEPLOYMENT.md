# Production Deployment Guide

This guide covers deploying the Ballroom Competition Scorer to a production environment.

## Why You Need a Service Account (Not Just Project ID)

When you initialize Firebase Admin SDK with just `projectId`, authentication **only works** in these scenarios:

1. **Running on Google Cloud** (Cloud Run, GKE, Compute Engine) - uses the metadata server
2. **Local development** with `gcloud auth application-default login`

On a non-GCP server, the SDK has no way to prove your server's identity to Firebase. You need a **service account** - a JSON file containing cryptographic keys that let Firebase verify your server is authorized to validate user tokens.

Without proper credentials, `auth.verifyIdToken()` will fail with authentication errors, and users won't be able to log in.

---

## Step 1: Create a Firebase Service Account

1. Go to [Firebase Console](https://console.firebase.google.com/) → Select your project (`ballroom-comp-manager`)

2. Click the **gear icon** → **Project settings** → **Service accounts** tab

3. Click **"Generate new private key"** → **"Generate key"**

4. A JSON file downloads (e.g., `ballroom-comp-manager-firebase-adminsdk-xxxxx.json`)

5. **Keep this file secure!** It grants full admin access to your Firebase project.

---

## Step 2: Configure the Backend

You have three options for providing credentials:

### Option A: Environment Variable (Recommended for Kubernetes)

Convert the JSON to a single line and set it as `FIREBASE_SERVICE_ACCOUNT`:

```bash
# On macOS/Linux, convert the JSON file to a single line:
cat service-account.json | jq -c .

# Then set it as an environment variable (example output):
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"ballroom-comp-manager","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"firebase-adminsdk-xxxxx@ballroom-comp-manager.iam.gserviceaccount.com",...}'
```

### Option B: File Path

Set `GOOGLE_APPLICATION_CREDENTIALS` to the path of your JSON file:

```bash
GOOGLE_APPLICATION_CREDENTIALS=/etc/secrets/firebase-service-account.json
```

### Option C: Running on GCP

If deploying to Cloud Run or GKE with Workload Identity, no credentials needed - just set:

```bash
FIREBASE_PROJECT_ID=ballroom-comp-manager
```

---

## Step 3: Configure the Frontend

Create `frontend/.env.local` (or set these at build time):

```bash
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=ballroom-comp-manager.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=ballroom-comp-manager
VITE_FIREBASE_STORAGE_BUCKET=ballroom-comp-manager.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
```

Get these values from Firebase Console → Project settings → General → Your apps → Web app config.

---

## Step 4: Build and Deploy with Docker

### Build the Image

```bash
# Build with frontend env vars baked in
docker build \
  --build-arg VITE_FIREBASE_API_KEY=your-api-key \
  --build-arg VITE_FIREBASE_AUTH_DOMAIN=ballroom-comp-manager.firebaseapp.com \
  --build-arg VITE_FIREBASE_PROJECT_ID=ballroom-comp-manager \
  --build-arg VITE_FIREBASE_STORAGE_BUCKET=ballroom-comp-manager.appspot.com \
  --build-arg VITE_FIREBASE_MESSAGING_SENDER_ID=123456789 \
  --build-arg VITE_FIREBASE_APP_ID=1:123456789:web:abcdef \
  -t ballroom-scorer:latest .
```

Or update the Dockerfile to accept build args (see below).

### Run Locally for Testing

```bash
docker run -p 3001:3001 \
  -e NODE_ENV=production \
  -e FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}' \
  -e DATA_STORE=json \
  ballroom-scorer:latest
```

---

## Step 5: Kubernetes Deployment

### Create a Secret for Firebase Credentials

```bash
# From the JSON file
kubectl create secret generic firebase-credentials \
  --from-file=service-account.json=./path-to-service-account.json

# Or from the JSON string
kubectl create secret generic firebase-credentials \
  --from-literal=FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'
```

### Example Kubernetes Manifests

**deployment.yaml:**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ballroom-scorer
spec:
  replicas: 2
  selector:
    matchLabels:
      app: ballroom-scorer
  template:
    metadata:
      labels:
        app: ballroom-scorer
    spec:
      containers:
      - name: app
        image: your-registry/ballroom-scorer:latest
        ports:
        - containerPort: 3001
        env:
        - name: NODE_ENV
          value: "production"
        - name: PORT
          value: "3001"
        - name: DATA_STORE
          value: "postgres"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: url
        - name: FIREBASE_SERVICE_ACCOUNT
          valueFrom:
            secretKeyRef:
              name: firebase-credentials
              key: FIREBASE_SERVICE_ACCOUNT
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3001
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 10
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

**service.yaml:**

```yaml
apiVersion: v1
kind: Service
metadata:
  name: ballroom-scorer
spec:
  selector:
    app: ballroom-scorer
  ports:
  - port: 80
    targetPort: 3001
  type: ClusterIP
```

**ingress.yaml** (with TLS):

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ballroom-scorer
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - ballroom.yourdomain.com
    secretName: ballroom-tls
  rules:
  - host: ballroom.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: ballroom-scorer
            port:
              number: 80
```

---

## Step 6: Database Setup (Production)

For production, use PostgreSQL instead of JSON files:

```bash
# Set environment variables
DATA_STORE=postgres
DATABASE_URL=postgresql://user:password@host:5432/ballroom_comp
```

The app will automatically use PostgreSQL when `DATA_STORE=postgres`.

---

## Quick Deployment Checklist

- [ ] Created Firebase service account and downloaded JSON
- [ ] Set `FIREBASE_SERVICE_ACCOUNT` or `GOOGLE_APPLICATION_CREDENTIALS`
- [ ] Configured frontend Firebase env vars (at build time)
- [ ] Set up PostgreSQL database (recommended for production)
- [ ] Configured Kubernetes secrets
- [ ] Set up TLS/HTTPS via Ingress
- [ ] Tested login flow end-to-end

---

## Troubleshooting

### "Unauthorized: Invalid token" errors

- Verify `FIREBASE_SERVICE_ACCOUNT` is valid JSON
- Check the service account has the correct project ID
- Ensure the frontend and backend use the same Firebase project

### Users can't sign in

- Check browser console for Firebase errors
- Verify `VITE_FIREBASE_*` env vars are set correctly
- Ensure your domain is in Firebase Auth → Settings → Authorized domains

### Container won't start

- Check logs: `kubectl logs deployment/ballroom-scorer`
- Verify all required env vars are set
- Test health endpoint: `curl http://localhost:3001/api/health`
