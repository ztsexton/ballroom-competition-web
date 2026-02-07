# Local HTTPS Development - Summary

## ✅ What Was Set Up

Your Ballroom Competition Web app now runs with HTTPS in local development, just like using dev certs in C#!

## 🔧 Changes Made

1. **Installed mkcert** - Tool for creating locally-trusted SSL certificates
2. **Generated SSL certificates** - Created valid certs for localhost
3. **Updated Vite config** - Frontend now uses HTTPS (port 3000)
4. **Updated backend server** - Backend now uses HTTPS (port 3001)
5. **Updated start script** - Shows correct HTTPS URLs
6. **Added .gitignore entry** - Keeps certificates local

## 🚀 How to Use

Just run your normal start command:
```bash
./start.sh
```

Your app will be available at:
- **Frontend:** https://localhost:3000 ✅
- **Backend:** https://localhost:3001 ✅

No browser security warnings! The certificates are trusted by your system.

## 📋 Key Features

- ✅ Locally-trusted certificates (like C# `dotnet dev-certs https --trust`)
- ✅ No browser warnings
- ✅ Works exactly like production HTTPS
- ✅ Certificates valid for 3 months
- ✅ Easy to regenerate with `./setup-https.sh`

## 🔄 Switching Back to HTTP

**Backend only:**
```bash
USE_HTTPS=false npm run dev
```

**Frontend:** Edit `vite.config.ts` and comment out the `https` section.

## 📚 Documentation

See `HTTPS_SETUP.md` for complete documentation including troubleshooting.

## 🔑 Certificate Location

Certificates are stored in `.cert/` (gitignored):
- `localhost+2.pem` - Certificate
- `localhost+2-key.pem` - Private key

These are automatically loaded by both frontend and backend when starting in dev mode.
