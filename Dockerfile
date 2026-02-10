# Multi-stage Dockerfile for Ballroom Competition Web
# Serves both frontend and backend from a single container

# ============================================
# Stage 1: Install dependencies and build
# ============================================
FROM node:20-alpine AS builder

WORKDIR /app

# Frontend Firebase config (required at build time - baked into JS bundle)
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_STORAGE_BUCKET
ARG VITE_FIREBASE_MESSAGING_SENDER_ID
ARG VITE_FIREBASE_APP_ID
ARG VITE_FIREBASE_AUTH_EMULATOR_HOST

# Base path for subpath deployment (e.g., '/ballroomcomp/' for domain.com/ballroomcomp)
# Must include trailing slash
ARG VITE_BASE_PATH=/

# Copy root workspace files
COPY package.json package-lock.json ./

# Copy workspace package.json files
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/

# Install all dependencies (both workspaces)
RUN npm ci

# Copy source files
COPY frontend/ ./frontend/
COPY backend/ ./backend/

# Build frontend (uses ARGs as env vars during build)
ENV VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY
ENV VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN
ENV VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID
ENV VITE_FIREBASE_STORAGE_BUCKET=$VITE_FIREBASE_STORAGE_BUCKET
ENV VITE_FIREBASE_MESSAGING_SENDER_ID=$VITE_FIREBASE_MESSAGING_SENDER_ID
ENV VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID
ENV VITE_BASE_PATH=$VITE_BASE_PATH
ENV VITE_FIREBASE_AUTH_EMULATOR_HOST=$VITE_FIREBASE_AUTH_EMULATOR_HOST
RUN npm run build --workspace=frontend

# Build backend
RUN npm run build --workspace=backend

# ============================================
# Stage 2: Production runtime
# ============================================
FROM node:20-alpine AS production

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy root workspace files for production install
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/

# Install only backend production dependencies
RUN npm ci --workspace=backend --omit=dev && npm cache clean --force

# Copy built backend from builder
COPY --from=builder /app/backend/dist ./dist

# Copy built frontend to be served as static files
COPY --from=builder /app/frontend/dist ./public

# Copy sample data for test competition seeding
COPY sample/seed.sql ./sample/seed.sql

# Create data directory for JSON storage (if using json data store)
RUN mkdir -p /app/data && chown -R nodejs:nodejs /app/data

# Set ownership
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Environment variables (runtime)
ENV NODE_ENV=production
ENV PORT=3001
ENV USE_HTTPS=false
# Backend Firebase credentials provided at runtime via:
# - FIREBASE_SERVICE_ACCOUNT (JSON string)
# - GOOGLE_APPLICATION_CREDENTIALS (file path)
# - Or automatic on GCP

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

# Start the server
CMD ["node", "dist/server.js"]
