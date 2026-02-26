# HTTPS Development Setup

This project is configured to run with HTTPS in local development, similar to using development certificates in C#/.NET.

## Quick Start

The certificates have already been generated, so you can just run:

```bash
./start.sh
```

Your app will be available at:
- Frontend: https://localhost:3000
- Backend: https://localhost:3001

## How It Works

We use [mkcert](https://github.com/FiloSottile/mkcert) to create locally-trusted development certificates. These certificates:
- Are automatically trusted by your browser (no security warnings)
- Work exactly like production HTTPS
- Are only valid for localhost (safe for development)
- Expire after 3 months (regenerate as needed)

## Regenerating Certificates

If your certificates expire or you need to regenerate them:

```bash
./setup-https.sh
```

## Running with HTTP Instead

If you need to disable HTTPS for any reason:

**Frontend:** Edit `vite.config.ts` and comment out the `https` section.

**Backend:** Set the environment variable:
```bash
USE_HTTPS=false ./start.sh
```

## How It Compares to C# Dev Certs

Just like in C# where you run:
```bash
dotnet dev-certs https --trust
```

We use `mkcert` which does the same thing:
```bash
mkcert -install  # Install the CA (one-time)
mkcert localhost # Generate certificates
```

## Files

- `.cert/` - Contains your SSL certificates (gitignored)
- `setup-https.sh` - Automated certificate setup script
- `vite.config.ts` - Frontend HTTPS configuration
- `backend/src/server.ts` - Backend HTTPS configuration

## Troubleshooting

### Browser Shows "Not Secure"
Run `./setup-https.sh` to regenerate and reinstall certificates.

### Certificate Expired
Certificates are valid for 3 months. Run `./setup-https.sh` to regenerate.

### ENOENT Error (Certificate Not Found)
Make sure the `.cert` directory exists with the certificate files:
```bash
ls -la .cert/
```
If missing, run `./setup-https.sh`.
