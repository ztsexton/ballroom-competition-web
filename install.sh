#!/bin/bash

# Installation script for Ballroom Competition Scorer
# React + Node.js + TypeScript version

echo "🎯 Ballroom Competition Scorer - Installation Script"
echo "=================================================="
echo ""

# Check Node.js version
echo "📦 Checking Node.js version..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version is too old. You have v$NODE_VERSION, but need v18 or higher."
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js version $(node -v) - OK"
echo ""

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd backend
if npm install; then
    echo "✅ Backend dependencies installed"
else
    echo "❌ Failed to install backend dependencies"
    exit 1
fi
cd ..
echo ""

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd frontend
if npm install; then
    echo "✅ Frontend dependencies installed"
else
    echo "❌ Failed to install frontend dependencies"
    exit 1
fi
cd ..
echo ""

echo "✅ Installation complete!"
echo ""
echo "🚀 Next steps:"
echo "   1. Start backend:  cd backend && npm run dev"
echo "   2. Start frontend: cd frontend && npm run dev"
echo "   3. Open browser:   http://localhost:3000"
echo ""
echo "📚 For more info, see README.md or doc/setup/QUICKSTART.md"
