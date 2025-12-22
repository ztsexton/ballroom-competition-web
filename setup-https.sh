#!/bin/bash

# HTTPS Setup Script for Ballroom Competition Scorer
# Generates SSL certificates for local development

echo "🔒 HTTPS Setup for Local Development"
echo "====================================="
echo ""

# Check if mkcert is installed
if ! command -v mkcert &> /dev/null; then
    echo "⚠️  mkcert is not installed."
    echo ""
    echo "Installing mkcert via Homebrew..."
    brew install mkcert
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install mkcert"
        exit 1
    fi
fi

# Install local CA
echo "📦 Installing local Certificate Authority..."
mkcert -install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install local CA"
    exit 1
fi

# Create certificate directory
echo "📁 Creating certificate directory..."
mkdir -p .cert

# Generate certificates
echo "🔑 Generating SSL certificates..."
cd .cert
mkcert localhost 127.0.0.1 ::1

if [ $? -ne 0 ]; then
    echo "❌ Failed to generate certificates"
    exit 1
fi

cd ..

echo ""
echo "✅ HTTPS setup complete!"
echo ""
echo "Your development servers will now run on:"
echo "  • Frontend: https://localhost:3000"
echo "  • Backend:  https://localhost:3001"
echo ""
echo "Certificates are valid until $(date -v+3m '+%B %d, %Y')"
echo ""
echo "To run with HTTP instead, set USE_HTTPS=false"
echo ""
