#!/bin/bash

# Start script for Ballroom Competition Scorer
# Runs both frontend and backend concurrently

echo "🎯 Ballroom Competition Scorer - Starting Development Servers"
echo "=============================================================="
echo ""

# Check if dependencies are installed
if [ ! -d "backend/node_modules" ] || [ ! -d "frontend/node_modules" ]; then
    echo "⚠️  Dependencies not found. Running installation first..."
    echo ""
    ./install.sh
    if [ $? -ne 0 ]; then
        echo "❌ Installation failed. Please fix errors and try again."
        exit 1
    fi
    echo ""
fi

# Function to handle cleanup on script exit
cleanup() {
    echo ""
    echo "🛑 Shutting down servers..."
    kill 0
    exit 0
}

# Set up trap to catch SIGINT (Ctrl+C) and cleanup
trap cleanup SIGINT SIGTERM

# Get backend port from environment or default
BACKEND_PORT=${PORT:-3001}

echo "🚀 Starting backend server..."
cd backend
npm run dev &
BACKEND_PID=$!
cd ..

echo "🚀 Starting frontend server..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "✅ Development servers started!"
echo ""
echo "📍 Frontend: https://localhost:3000"
echo "📍 Backend:  https://localhost:${BACKEND_PORT}"
echo ""
echo "Press Ctrl+C to stop both servers"
echo ""

# Wait for both processes
wait
